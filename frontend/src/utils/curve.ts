/** 曲线数据处理工具：数据净化、自适应格式化。
 *
 * 抽离自 CurveChart 组件以便单元测试覆盖边界场景。
 */
import type { CurveData, PointXY } from '../types'

/** 过滤无效点（NaN / Infinity / null）并按 x 排序。
 *
 * ECharts 在 series.data 中遇到 NaN/Infinity 会导致该系列渲染中断，
 * 未排序的数据会画出锯齿线。本函数统一在渲染前清洗。
 *
 * @param curve 原始曲线数据
 * @param sort 是否按 x 升序排序（两点偏移线无需排序）
 */
export function sanitize(curve: PointXY[] | undefined, sort = true): [number, number][] {
  if (!Array.isArray(curve) || curve.length === 0) return []
  const cleaned: [number, number][] = []
  for (const p of curve) {
    if (!p) continue
    const x = Number(p.x)
    const y = Number(p.y)
    if (Number.isFinite(x) && Number.isFinite(y)) {
      cleaned.push([x, y])
    }
  }
  if (sort && cleaned.length > 1) {
    cleaned.sort((a, b) => a[0] - b[0])
  }
  return cleaned
}

/** 自适应数值格式：极小或极大用科学计数，常规值用定点。
 *
 * ECharts 默认对 0.002 这种值显示为 "0.002"，应变值常见 1e-4 量级时
 * 标签会重叠。本函数根据数值量级切换显示方式。
 */
export function adaptiveFormat(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs === 0) return '0'
  if (abs < 1e-3 || abs >= 1e4) return v.toExponential(2)
  if (abs < 1) return v.toFixed(4)
  if (abs < 100) return v.toFixed(2)
  return v.toFixed(1)
}

/** 计算曲线集合的整体坐标范围，用于设置坐标轴余白。
 *
 * 返回 null 表示无有效数据。
 */
export function computeRange(
  curves: CurveData
): { xMin: number; xMax: number; yMin: number; yMax: number } | null {
  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  let has = false
  for (const key of Object.keys(curves) as (keyof CurveData)[]) {
    const data = sanitize(curves[key], true)
    for (const [x, y] of data) {
      has = true
      if (x < xMin) xMin = x
      if (x > xMax) xMax = x
      if (y < yMin) yMin = y
      if (y > yMax) yMax = y
    }
  }
  if (!has) return null
  return { xMin, xMax, yMin, yMax }
}
