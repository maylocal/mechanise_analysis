import { describe, it, expect } from 'vitest'
import { sanitize, adaptiveFormat, computeRange } from './curve'
import type { CurveData } from '../types'

describe('sanitize', () => {
  it('空数组或 undefined 返回空数组', () => {
    expect(sanitize(undefined)).toEqual([])
    expect(sanitize([])).toEqual([])
    expect(sanitize([], true)).toEqual([])
  })

  it('过滤 NaN 与 Infinity', () => {
    const input = [
      { x: 0, y: 0 },
      { x: NaN, y: 1 },
      { x: 1, y: NaN },
      { x: 2, y: Infinity },
      { x: 3, y: -Infinity },
      { x: 4, y: 100 },
    ]
    expect(sanitize(input)).toEqual([
      [0, 0],
      [4, 100],
    ])
  })

  it('过滤 null/undefined 元素', () => {
    const input: any[] = [null, undefined, { x: 1, y: 2 }, { x: 3, y: 4 }]
    expect(sanitize(input)).toEqual([
      [1, 2],
      [3, 4],
    ])
  })

  it('默认按 x 升序排序', () => {
    const input = [
      { x: 3, y: 30 },
      { x: 1, y: 10 },
      { x: 2, y: 20 },
    ]
    expect(sanitize(input)).toEqual([
      [1, 10],
      [2, 20],
      [3, 30],
    ])
  })

  it('sort=false 保留原顺序（偏移线场景）', () => {
    const input = [
      { x: 0.2, y: 300 },
      { x: 0, y: -10 },
    ]
    expect(sanitize(input, false)).toEqual([
      [0.2, 300],
      [0, -10],
    ])
  })

  it('字符串数值能被 Number 转换', () => {
    const input: any[] = [
      { x: '1', y: '10' },
      { x: '2', y: '20' },
    ]
    expect(sanitize(input)).toEqual([
      [1, 10],
      [2, 20],
    ])
  })

  it('单点数据保留', () => {
    expect(sanitize([{ x: 0.5, y: 100 }])).toEqual([[0.5, 100]])
  })

  it('所有点无效返回空数组（不应抛错）', () => {
    expect(sanitize([{ x: NaN, y: NaN }])).toEqual([])
  })

  it('相同 x 值都保留（不丢点）', () => {
    const input = [
      { x: 1, y: 10 },
      { x: 1, y: 11 },
      { x: 1, y: 12 },
    ]
    expect(sanitize(input).length).toBe(3)
  })
})

describe('adaptiveFormat', () => {
  it('非有限值返回占位符', () => {
    expect(adaptiveFormat(NaN)).toBe('—')
    expect(adaptiveFormat(Infinity)).toBe('—')
    expect(adaptiveFormat(-Infinity)).toBe('—')
  })

  it('零返回 "0"', () => {
    expect(adaptiveFormat(0)).toBe('0')
    expect(adaptiveFormat(-0)).toBe('0')
  })

  it('极小值用科学计数（< 1e-3）', () => {
    expect(adaptiveFormat(0.0001)).toBe('1.00e-4')
    expect(adaptiveFormat(0.00001)).toBe('1.00e-5')
    expect(adaptiveFormat(-0.0005)).toBe('-5.00e-4')
  })

  it('极大值用科学计数（>= 1e4）', () => {
    expect(adaptiveFormat(10000)).toBe('1.00e+4')
    expect(adaptiveFormat(210000)).toBe('2.10e+5')
  })

  it('1e-3 到 1 之间用定点 4 位小数', () => {
    expect(adaptiveFormat(0.001)).toBe('0.0010')
    expect(adaptiveFormat(0.002)).toBe('0.0020')
    expect(adaptiveFormat(0.5)).toBe('0.5000')
    expect(adaptiveFormat(0.123)).toBe('0.1230')
  })

  it('1 到 100 之间用 2 位小数', () => {
    expect(adaptiveFormat(50)).toBe('50.00')
    expect(adaptiveFormat(99.9)).toBe('99.90')
  })

  it('100 及以上用 1 位小数', () => {
    expect(adaptiveFormat(100)).toBe('100.0')
    expect(adaptiveFormat(9999)).toBe('9999.0')
  })
})

describe('computeRange', () => {
  const emptyCurves: CurveData = {
    engineering: [],
    true_curve: [],
    plastic: [],
    yield_line: [],
    hardening_fit: [],
  }

  it('全部为空返回 null', () => {
    expect(computeRange(emptyCurves)).toBeNull()
  })

  it('全部为无效点返回 null', () => {
    expect(
      computeRange({
        ...emptyCurves,
        engineering: [{ x: NaN, y: NaN }],
      })
    ).toBeNull()
  })

  it('部分系列有数据返回整体范围', () => {
    const r = computeRange({
      ...emptyCurves,
      engineering: [
        { x: 0, y: 0 },
        { x: 0.1, y: 200 },
      ],
      plastic: [{ x: 0.05, y: 300 }],
    })
    expect(r).not.toBeNull()
    expect(r!.xMin).toBe(0)
    expect(r!.xMax).toBe(0.1)
    expect(r!.yMin).toBe(0)
    expect(r!.yMax).toBe(300)
  })

  it('包含负值也能正确计算', () => {
    const r = computeRange({
      ...emptyCurves,
      yield_line: [
        { x: 0, y: -420 },
        { x: 0.2, y: 0 },
      ],
    })
    expect(r).toEqual({ xMin: 0, xMax: 0.2, yMin: -420, yMax: 0 })
  })

  it('单点数据返回该点作为范围', () => {
    const r = computeRange({
      ...emptyCurves,
      engineering: [{ x: 0.1, y: 100 }],
    })
    expect(r).toEqual({ xMin: 0.1, xMax: 0.1, yMin: 100, yMax: 100 })
  })
})
