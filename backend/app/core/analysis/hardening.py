"""应变硬化指数 n 值拟合（Hollomon 方程）。"""
import numpy as np

from .curve import CurveAnalyzer


class HollomonFitter:
    """Hollomon 方程 σ = K·ε^n 拟合。"""

    def __init__(self, analyzer: CurveAnalyzer):
        self.analyzer = analyzer

    def fit(self, E: float, offset: float = 0.002) -> tuple[float | None, float | None]:
        """拟合 n 值与强度系数 K。

        在均匀塑性变形段（屈服后至颈缩前）对真实应力-塑性应变取对数线性拟合。
        返回 (n, K)，数据不足或结果物理上无意义时返回 (None, None)。
        """
        plastic_strain, true_stress = self.analyzer.plastic_strain(E)

        necking_idx = self.analyzer.necking_index()
        yield_idx = self.analyzer.yield_index(E, offset)

        # 均匀塑性段：屈服后、颈缩前、塑性应变为正
        start = max(yield_idx, 1)
        end = necking_idx if necking_idx > start else len(plastic_strain)

        mask = (
            (np.arange(len(plastic_strain)) >= start)
            & (np.arange(len(plastic_strain)) < end)
            & (plastic_strain > 1e-5)
            & (true_stress > 0)
            & np.isfinite(plastic_strain)
            & np.isfinite(true_stress)
        )

        if mask.sum() < 3:
            return None, None

        log_eps = np.log(plastic_strain[mask])
        log_sigma = np.log(true_stress[mask])

        # 线性拟合 ln(σ) = ln(K) + n·ln(ε)
        A = np.vstack([log_eps, np.ones_like(log_eps)]).T
        n, log_k = np.linalg.lstsq(A, log_sigma, rcond=None)[0]

        # 物理校验：n 应在 (0, 1) 区间
        if not np.isfinite(n) or n <= 0 or n >= 1:
            return None, None
        if not np.isfinite(log_k):
            return None, None

        K = float(np.exp(log_k))
        return float(n), K

    def fit_curve(
        self, n: float | None, K: float | None, E: float
    ) -> list[tuple[float, float]]:
        """生成 Hollomon 拟合曲线点 (plastic_strain, true_stress)。"""
        if n is None or K is None:
            return []

        plastic_strain, _ = self.analyzer.plastic_strain(E)
        valid = plastic_strain[(plastic_strain > 1e-4) & np.isfinite(plastic_strain)]
        if len(valid) == 0:
            return []

        # 设下限避免负 n 时溢出（n 已校验为正，此处仅为稳健性）
        eps_min = max(float(valid.min()), 1e-4)
        eps_max = float(valid.max())
        eps_fit = np.linspace(eps_min, eps_max, 50)
        sigma_fit = K * np.power(eps_fit, n)
        # 过滤非有限值
        return [
            (float(e), float(s))
            for e, s in zip(eps_fit, sigma_fit)
            if np.isfinite(s)
        ]
