"""塑性应变比 r 值计算。"""
import numpy as np

from .curve import CurveAnalyzer


class PlasticStrainRatio:
    """塑性应变比 r 值计算。

    基于体积不可压缩假设 ε_a + ε_w + ε_t = 0：
        r = ε_w / ε_t = −ε_w / (ε_a + ε_w)
    """

    def __init__(self, analyzer: CurveAnalyzer, width_strain: np.ndarray):
        """初始化。

        width_strain: 与 strain 对应的横向（宽度）应变数组。
        """
        self.analyzer = analyzer
        self.width_strain = np.asarray(width_strain, dtype=float)

    def compute(self, target_strain: float = 0.15) -> float | None:
        """计算目标轴向应变处的 r 值。

        target_strain: 目标轴向工程应变（默认 15%）。
        无横向应变数据或超出范围时返回 None。
        """
        axial = self.analyzer.strain
        width = self.width_strain

        if width.size == 0 or np.all(np.isnan(width)):
            return None

        # 目标应变超出数据范围则取 80% 最大应变
        if target_strain > float(np.max(axial)):
            target_strain = 0.8 * float(np.max(axial))
        if target_strain <= 0:
            return None

        # 插值得到目标应变处的横向应变
        w_at = float(np.interp(target_strain, axial, width))

        # r = -ε_w / (ε_a + ε_w)
        denom = target_strain + w_at
        if abs(denom) < 1e-12:
            return None
        r = -w_at / denom
        return float(r)
