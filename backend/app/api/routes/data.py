"""样例数据 API 路由：提供预设应力应变数据集。"""
import numpy as np
from fastapi import APIRouter

from app.core.schemas import DataPoint, SampleDataset

router = APIRouter()


def _ludwik_curve(
    E: float,
    sigma_y: float,
    K: float,
    n: float,
    eps_fracture: float,
    num_plastic: int = 180,
    num_elastic: int = 40,
    plateau: float = 0.0,
) -> tuple[np.ndarray, np.ndarray]:
    """基于 Ludwik 方程生成工程应力-应变曲线。

    σ_t = σ_y + K·(ε_t − ε_y)^n （塑性段）
    弹性段单独加密采样以保证弹性模量拟合精度。
    """
    eps_y = sigma_y / E
    eps_t_max = np.log(1.0 + eps_fracture)

    # 弹性段加密采样
    eps_t_elastic = np.linspace(0.0, eps_y, num_elastic)
    # 塑性段采样
    eps_t_plastic = np.linspace(eps_y, eps_t_max, num_plastic)
    eps_t = np.concatenate([eps_t_elastic, eps_t_plastic[1:]])

    sigma_t = np.where(
        eps_t <= eps_y,
        E * eps_t,
        sigma_y + K * np.power(np.maximum(eps_t - eps_y, 1e-9), n),
    )

    # 屈服平台：在 ε_y 附近保持应力近似恒定
    if plateau > 0:
        plat_mask = (eps_t > eps_y) & (eps_t < eps_y + plateau)
        sigma_t[plat_mask] = sigma_y

    # 转换为工程应力应变
    eps_e = np.exp(eps_t) - 1.0
    sigma_e = sigma_t * np.exp(-eps_t)
    return eps_e, sigma_e


def _make_dataset(
    name: str,
    description: str,
    eps: np.ndarray,
    sigma: np.ndarray,
    width_ratio: float | None = None,
) -> SampleDataset:
    """构造样例数据集，可选附加横向应变（用于 r 值）。"""
    data = []
    for e, s in zip(eps, sigma):
        w = None
        if width_ratio is not None and e > 0.001:
            # 横向应变 ≈ -width_ratio * 塑性轴向应变
            w = -width_ratio * max(e - 0.001, 0.0)
        data.append(
            DataPoint(
                strain=round(float(e), 6),
                stress=round(float(s), 3),
                width_strain=round(w, 6) if w is not None else None,
            )
        )
    return SampleDataset(name=name, description=description, data=data)


@router.get("/samples", summary="获取样例数据集列表")
def list_samples():
    """返回可用的样例数据集名称。"""
    return {"samples": ["low_carbon_steel", "aluminum_alloy", "high_strength_steel"]}


@router.get("/samples/{name}", response_model=SampleDataset, summary="获取样例数据集")
def get_sample(name: str):
    """根据名称获取样例应力应变数据集。"""
    datasets = {
        "low_carbon_steel": _make_dataset(
            "低碳钢",
            "Q235 低碳钢，有明显屈服平台，E≈210GPa",
            *_ludwik_curve(
                E=210000.0, sigma_y=250.0, K=900.0, n=0.18,
                eps_fracture=0.25, plateau=0.015,
            ),
        ),
        "aluminum_alloy": _make_dataset(
            "铝合金",
            "6061-T6 铝合金，连续屈服，E≈70GPa",
            *_ludwik_curve(
                E=70000.0, sigma_y=280.0, K=450.0, n=0.12, eps_fracture=0.15,
            ),
        ),
        "high_strength_steel": _make_dataset(
            "高强钢",
            "DP780 双相钢，含横向应变数据可计算 r 值，E≈210GPa",
            *_ludwik_curve(
                E=210000.0, sigma_y=480.0, K=1200.0, n=0.14, eps_fracture=0.18,
            ),
            width_ratio=0.545,  # 对应 r≈1.2
        ),
    }
    if name not in datasets:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail=f"样例数据集 {name} 不存在")
    return datasets[name]
