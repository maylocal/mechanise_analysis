"""数据模型定义（Pydantic）。"""
from pydantic import BaseModel, Field


class DataPoint(BaseModel):
    """应力应变数据点。"""

    strain: float = Field(..., description="工程应变")
    stress: float = Field(..., description="工程应力 (MPa)")
    width_strain: float | None = Field(None, description="横向（宽度）应变，用于 r 值计算")


class AnalysisRequest(BaseModel):
    """拉伸数据分析请求。"""

    data: list[DataPoint] = Field(..., description="应力应变数据点")
    elastic_modulus: float | None = Field(
        None, description="弹性模量 E (MPa)，未提供则自动拟合"
    )
    yield_offset: float = Field(0.002, description="屈服偏移量（默认 0.2%）")
    r_value_strain: float = Field(0.15, description="r 值计算的目标轴向应变")


class PointXY(BaseModel):
    """二维点。"""

    x: float
    y: float


class CurveData(BaseModel):
    """分析曲线数据。"""

    engineering: list[PointXY] = Field(..., description="工程应力-应变曲线")
    true_curve: list[PointXY] = Field(..., description="真实应力-应变曲线")
    plastic: list[PointXY] = Field(..., description="塑性应变-真实应力曲线")
    yield_line: list[PointXY] = Field(..., description="屈服偏移线")
    hardening_fit: list[PointXY] = Field(..., description="Hollomon 拟合曲线")


class MaterialProperties(BaseModel):
    """材料力学性能参数。"""

    elastic_modulus: float | None = Field(None, description="弹性模量 E (MPa)")
    yield_strength: float | None = Field(None, description="屈服强度 Rp0.2 (MPa)")
    tensile_strength: float | None = Field(None, description="抗拉强度 Rm (MPa)")
    elongation: float | None = Field(None, description="延伸率 A (%)")
    fracture_strain: float | None = Field(None, description="断裂工程应变")
    n_value: float | None = Field(None, description="应变硬化指数 n")
    k_value: float | None = Field(None, description="强度系数 K (MPa)")
    r_value: float | None = Field(None, description="塑性应变比 r")


class AnalysisResponse(BaseModel):
    """分析结果。"""

    properties: MaterialProperties
    curves: CurveData
    message: str = "分析完成"


class SampleDataset(BaseModel):
    """样例数据集。"""

    name: str
    description: str
    data: list[DataPoint]
