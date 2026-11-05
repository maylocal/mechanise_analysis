"""材料性能计算：屈服强度、抗拉强度、延伸率。"""
import numpy as np

from .curve import CurveAnalyzer


class PropertyCalculator:
    """计算材料力学性能参数。"""

    def __init__(self, analyzer: CurveAnalyzer):
        self.analyzer = analyzer

    def tensile_strength(self) -> float:
        """抗拉强度 Rm：工程应力最大值 (MPa)。"""
        return float(np.max(self.analyzer.stress))

    def elongation(self) -> float:
        """延伸率 A：断裂工程应变百分比 (%)。"""
        return float(self.analyzer.strain[-1] * 100.0)

    def fracture_strain(self) -> float:
        """断裂工程应变。"""
        return float(self.analyzer.strain[-1])

    def yield_strength(self, E: float, offset: float = 0.002) -> float:
        """屈服强度 Rp0.2：偏移线与曲线交点应力 (MPa)。

        偏移线 σ = E·(ε − offset)，通过分段线性插值求交点。
        弹性段曲线在偏移线上方（diff>0），屈服后 diff<0。
        """
        strain = self.analyzer.strain
        stress = self.analyzer.stress
        offset_line = E * (strain - offset)
        diff = stress - offset_line

        for i in range(1, len(diff)):
            # 弹性段 diff>0，屈服后 diff<0，寻找由正变负的交叉点
            if diff[i - 1] > 0 and diff[i] <= 0:
                # 线性插值求交点应变
                t = diff[i - 1] / (diff[i - 1] - diff[i])
                eps_cross = strain[i - 1] + t * (strain[i] - strain[i - 1])
                sigma_cross = E * (eps_cross - offset)
                return float(max(sigma_cross, 0.0))

        # 未找到交点，取偏移应变之后的最大应力作为保守估计
        mask = strain >= offset
        if mask.any():
            return float(np.max(stress[mask]))
        return float(np.max(stress))
