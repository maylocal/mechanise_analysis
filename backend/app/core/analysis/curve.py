"""曲线分析：弹性模量识别、工程/真实曲线转换、塑性应变。"""
import numpy as np


class CurveAnalyzer:
    """应力应变曲线分析工具。"""

    def __init__(self, strain: np.ndarray, stress: np.ndarray):
        """初始化，输入工程应变与工程应力。"""
        if len(strain) == 0:
            raise ValueError("应变数组为空")
        # 按应变排序
        order = np.argsort(strain)
        self.strain = np.asarray(strain, dtype=float)[order]
        self.stress = np.asarray(stress, dtype=float)[order]

    def compute_elastic_modulus(self) -> float:
        """识别初始线性段并拟合弹性模量 E (MPa)。

        策略：在低应力区间（最大应力的 10%~50%）滑动窗口，
        选取线性回归 R² 最高的窗口斜率作为 E。
        """
        max_stress = float(np.max(self.stress))
        # 候选点：避开初始非线性 toe 区与屈服区
        lo, hi = 0.10 * max_stress, 0.50 * max_stress
        mask = (self.stress >= lo) & (self.stress <= hi)
        if mask.sum() < 5:
            mask = self.stress <= 0.5 * max_stress
        if mask.sum() < 3:
            # 退化为整体前段拟合
            n = max(3, len(self.strain) // 4)
            mask = np.zeros_like(self.strain, dtype=bool)
            mask[:n] = True

        s_x = self.strain[mask]
        s_y = self.stress[mask]
        if len(s_x) < 2:
            return float(max_stress / max(self.strain[-1], 1e-6))

        best_slope = 0.0
        best_r2 = -np.inf
        n = len(s_x)
        # 滑动窗口（至少 5 个点）
        win = max(5, n // 3)
        for start in range(0, n - win + 1):
            xw = s_x[start : start + win]
            yw = s_y[start : start + win]
            slope, intercept = np.polyfit(xw, yw, 1)
            y_pred = slope * xw + intercept
            ss_res = float(np.sum((yw - y_pred) ** 2))
            ss_tot = float(np.sum((yw - np.mean(yw)) ** 2))
            r2 = 1 - ss_res / ss_tot if ss_tot > 0 else -np.inf
            if r2 > best_r2 and slope > 0:
                best_r2 = r2
                best_slope = slope

        if best_slope <= 0:
            # 退化：整体线性拟合
            best_slope = float(np.polyfit(s_x, s_y, 1)[0])
        return float(best_slope)

    def to_true_curve(self) -> tuple[np.ndarray, np.ndarray]:
        """转换为真实应力-真实应变。

        真实应力 σ_t = σ_e(1 + ε_e)
        真实应变 ε_t = ln(1 + ε_e)
        """
        eps = self.strain
        # 避免 log(0) 或负值
        eps_safe = np.clip(eps, -0.999, None)
        true_strain = np.log1p(eps_safe)
        true_stress = self.stress * (1.0 + eps_safe)
        return true_strain, true_stress

    def plastic_strain(self, E: float) -> tuple[np.ndarray, np.ndarray]:
        """计算塑性应变与对应真实应力。

        ε_p = ε_t − σ_t / E
        返回 (plastic_strain, true_stress)
        """
        if E <= 0:
            raise ValueError("弹性模量 E 必须大于 0")
        true_strain, true_stress = self.to_true_curve()
        plastic = true_strain - true_stress / E
        return plastic, true_stress

    def necking_index(self) -> int:
        """返回颈缩起始点索引（工程应力最大处）。"""
        return int(np.argmax(self.stress))

    def yield_index(self, E: float, offset: float = 0.002) -> int:
        """返回屈服点索引（0.2% 偏移线与曲线交点）。

        弹性段曲线在偏移线上方（diff>0），屈服后偏移线追上并超过曲线
        （diff 由正变负），该交叉点即为屈服点。
        """
        diff = self.stress - E * (self.strain - offset)
        for i in range(1, len(diff)):
            if diff[i - 1] > 0 >= diff[i]:
                return i
        # 回退：取偏移应变附近的点
        return int(np.argmin(np.abs(self.strain - offset)))
