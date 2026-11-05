"""拉伸数据分析 API 路由。"""
import numpy as np
from fastapi import APIRouter, HTTPException

from app.core.schemas import (
    AnalysisRequest,
    AnalysisResponse,
    CurveData,
    MaterialProperties,
    PointXY,
)
from app.core.analysis import (
    CurveAnalyzer,
    PropertyCalculator,
    HollomonFitter,
    PlasticStrainRatio,
)

router = APIRouter()


@router.post("/tensile", response_model=AnalysisResponse, summary="拉伸性能分析")
def run_tensile_analysis(request: AnalysisRequest):
    """导入应力应变数据，计算材料力学性能并生成曲线。

    返回：弹性模量、屈服强度、抗拉强度、延伸率、n 值、r 值及各类曲线。
    """
    if len(request.data) < 5:
        raise HTTPException(status_code=400, detail="数据点过少，至少需要 5 个点")

    strain = np.array([p.strain for p in request.data])
    stress = np.array([p.stress for p in request.data])
    width_raw = np.array(
        [p.width_strain if p.width_strain is not None else np.nan for p in request.data]
    )

    if np.any(~np.isfinite(strain)) or np.any(strain < 0):
        raise HTTPException(status_code=400, detail="工程应变包含无效值或为负")
    if np.any(~np.isfinite(stress)) or np.any(stress < 0):
        raise HTTPException(status_code=400, detail="工程应力包含无效值或为负")

    # 按应变统一排序，保证 strain/stress/width 对齐
    order = np.argsort(strain)
    strain = strain[order]
    stress = stress[order]
    width_raw = width_raw[order]

    # 曲线分析器
    analyzer = CurveAnalyzer(strain, stress)

    # 弹性模量
    try:
        E = request.elastic_modulus or analyzer.compute_elastic_modulus()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"弹性模量拟合失败: {e}")
    if E <= 0:
        raise HTTPException(status_code=400, detail="弹性模量拟合结果无效")

    # 性能参数
    calc = PropertyCalculator(analyzer)
    tensile = calc.tensile_strength()
    elongation = calc.elongation()
    fracture = calc.fracture_strain()
    try:
        yield_str = calc.yield_strength(E, request.yield_offset)
    except Exception:
        yield_str = None

    # n 值与 K 值
    fitter = HollomonFitter(analyzer)
    try:
        n_val, k_val = fitter.fit(E, request.yield_offset)
    except Exception:
        n_val, k_val = None, None

    # r 值（需要横向应变）
    r_val = None
    valid_w = ~np.isnan(width_raw)
    if valid_w.sum() >= 2:
        # 用有效段插值补全缺失的横向应变
        w_interp = np.interp(strain, strain[valid_w], width_raw[valid_w])
        ratio = PlasticStrainRatio(analyzer, w_interp)
        try:
            r_val = ratio.compute(request.r_value_strain)
        except Exception:
            r_val = None

    properties = MaterialProperties(
        elastic_modulus=round(E, 1),
        yield_strength=round(yield_str, 2) if yield_str is not None else None,
        tensile_strength=round(tensile, 2),
        elongation=round(elongation, 2),
        fracture_strain=round(fracture, 5),
        n_value=round(n_val, 4) if n_val is not None else None,
        k_value=round(k_val, 2) if k_val is not None else None,
        r_value=round(r_val, 4) if r_val is not None else None,
    )

    # 曲线数据
    engineering = [PointXY(x=float(s), y=float(t)) for s, t in zip(strain, stress)]

    true_strain, true_stress = analyzer.to_true_curve()
    true_curve = [PointXY(x=float(e), y=float(s)) for e, s in zip(true_strain, true_stress)]

    plastic_strain, plastic_stress = analyzer.plastic_strain(E)
    plastic = [
        PointXY(x=float(e), y=float(s))
        for e, s in zip(plastic_strain, plastic_stress)
        if e > 0
    ]

    # 屈服偏移线
    eps_max = float(strain.max())
    yield_line = [
        PointXY(x=0.0, y=-E * request.yield_offset),
        PointXY(x=eps_max, y=E * (eps_max - request.yield_offset)),
    ]

    # Hollomon 拟合曲线
    fit_points = fitter.fit_curve(n_val, k_val, E)
    hardening_fit = [PointXY(x=e, y=s) for e, s in fit_points]

    curves = CurveData(
        engineering=engineering,
        true_curve=true_curve,
        plastic=plastic,
        yield_line=yield_line,
        hardening_fit=hardening_fit,
    )

    return AnalysisResponse(properties=properties, curves=curves)
