/** Mock 数据：后端不可用时回退使用。 */
import type {
  AnalysisRequest,
  AnalysisResponse,
  CurveData,
  DataPoint,
  MaterialProperties,
  PointXY,
  SampleDataset,
} from '../types'

/** 低碳钢样例数据 (Q235, E≈210GPa, σ_y≈250MPa, σ_m≈420MPa, A≈25%) */
function generateLowCarbonSteel(): SampleDataset {
  const E = 210000
  const sigmaY = 250
  const K = 900
  const n = 0.18
  const epsY = sigmaY / E
  const epsFracture = 0.25
  const numElastic = 40
  const numPlastic = 180
  const plateau = 0.015

  // 弹性段加密采样
  const epsTE = Array.from({ length: numElastic }, (_, i) => (epsY * i) / (numElastic - 1))
  // 塑性段采样
  const epsTPl = Array.from(
    { length: numPlastic },
    (_, i) => epsY + ((Math.log(1 + epsFracture) - epsY) * i) / (numPlastic - 1)
  )
  const epsT = [...epsTE, ...epsTPl.slice(1)]

  const sigmaT = epsT.map((e) => {
    if (e <= epsY) return E * e
    if (e < epsY + plateau) return sigmaY
    return sigmaY + K * Math.pow(Math.max(e - epsY, 1e-9), n)
  })

  const data: DataPoint[] = epsT.map((et, i) => {
    const ee = Math.exp(et) - 1
    const se = sigmaT[i] * Math.exp(-et)
    return {
      strain: Number(ee.toFixed(6)),
      stress: Number(se.toFixed(3)),
      width_strain: null,
    }
  })

  return { name: '低碳钢', description: 'Q235 低碳钢，有明显屈服平台', data }
}

/** 铝合金样例数据 (6061-T6, E≈70GPa) */
function generateAluminumAlloy(): SampleDataset {
  const E = 70000
  const sigmaY = 280
  const K = 450
  const n = 0.12
  const epsY = sigmaY / E
  const epsFracture = 0.15
  const numElastic = 40
  const numPlastic = 180

  const epsTE = Array.from({ length: numElastic }, (_, i) => (epsY * i) / (numElastic - 1))
  const epsTPl = Array.from(
    { length: numPlastic },
    (_, i) => epsY + ((Math.log(1 + epsFracture) - epsY) * i) / (numPlastic - 1)
  )
  const epsT = [...epsTE, ...epsTPl.slice(1)]

  const sigmaT = epsT.map((e) => {
    if (e <= epsY) return E * e
    return sigmaY + K * Math.pow(Math.max(e - epsY, 1e-9), n)
  })

  const data: DataPoint[] = epsT.map((et, i) => {
    const ee = Math.exp(et) - 1
    const se = sigmaT[i] * Math.exp(-et)
    return {
      strain: Number(ee.toFixed(6)),
      stress: Number(se.toFixed(3)),
      width_strain: null,
    }
  })

  return { name: '铝合金', description: '6061-T6 铝合金，连续屈服', data }
}

/** 高强钢样例数据 (DP780, E≈210GPa, 含横向应变) */
function generateHighStrengthSteel(): SampleDataset {
  const E = 210000
  const sigmaY = 480
  const K = 1200
  const n = 0.14
  const epsY = sigmaY / E
  const epsFracture = 0.18
  const numElastic = 40
  const numPlastic = 180
  const widthRatio = 0.545

  const epsTE = Array.from({ length: numElastic }, (_, i) => (epsY * i) / (numElastic - 1))
  const epsTPl = Array.from(
    { length: numPlastic },
    (_, i) => epsY + ((Math.log(1 + epsFracture) - epsY) * i) / (numPlastic - 1)
  )
  const epsT = [...epsTE, ...epsTPl.slice(1)]

  const sigmaT = epsT.map((e) => {
    if (e <= epsY) return E * e
    return sigmaY + K * Math.pow(Math.max(e - epsY, 1e-9), n)
  })

  const data: DataPoint[] = epsT.map((et, i) => {
    const ee = Math.exp(et) - 1
    const se = sigmaT[i] * Math.exp(-et)
    let ws: number | null = null
    if (ee > 0.001) {
      ws = Number((-widthRatio * Math.max(ee - 0.001, 0)).toFixed(6))
    }
    return {
      strain: Number(ee.toFixed(6)),
      stress: Number(se.toFixed(3)),
      width_strain: ws,
    }
  })

  return { name: '高强钢', description: 'DP780 双相钢，含横向应变可计算 r 值', data }
}

const mockDatasets: Record<string, SampleDataset> = {
  low_carbon_steel: generateLowCarbonSteel(),
  aluminum_alloy: generateAluminumAlloy(),
  high_strength_steel: generateHighStrengthSteel(),
}

export function getMockSampleNames(): string[] {
  return Object.keys(mockDatasets)
}

export function getMockSample(name: string): SampleDataset | null {
  return mockDatasets[name] ?? null
}

/** 生成给定请求的 mock 分析结果（本地计算）。 */
export function getMockAnalysis(req: AnalysisRequest): AnalysisResponse {
  const points = req.data
  if (points.length < 5) {
    return {
      properties: { elastic_modulus: null },
      curves: {
        engineering: [],
        true_curve: [],
        plastic: [],
        yield_line: [],
        hardening_fit: [],
      },
      message: '数据点不足',
    }
  }

  const E = req.elastic_modulus ?? 210000
  const offset = req.yield_offset ?? 0.002
  const rStrain = req.r_value_strain ?? 0.15

  // 排序
  const sorted = [...points].sort((a, b) => a.strain - b.strain)
  const strains = sorted.map((p) => p.strain)
  const stresses = sorted.map((p) => p.stress)
  const widths = sorted.map((p) => p.width_strain ?? NaN)

  // 弹性模量（简化：取前 1/4 线性拟合）
  const nFit = Math.max(5, Math.floor(strains.length / 4))
  let ECalc = E
  try {
    let bestSlope = 0
    for (let start = 0; start <= strains.length - nFit; start++) {
      let sx = 0, sy = 0, sxy = 0, sxx = 0
      for (let j = 0; j < nFit; j++) {
        const x = strains[start + j]
        const y = stresses[start + j]
        sx += x; sy += y; sxy += x * y; sxx += x * x
      }
      const slope = (nFit * sxy - sx * sy) / (nFit * sxx - sx * sx || 1)
      if (slope > bestSlope) bestSlope = slope
    }
    if (bestSlope > 0) ECalc = bestSlope
  } catch {}

  // 屈服强度（偏移法）
  let yieldStr: number | null = null
  for (let i = 1; i < strains.length; i++) {
    const d0 = stresses[i - 1] - ECalc * (strains[i - 1] - offset)
    const d1 = stresses[i] - ECalc * (strains[i] - offset)
    if (d0 > 0 && d1 <= 0) {
      const t = d0 / (d0 - d1)
      const epsCross = strains[i - 1] + t * (strains[i] - strains[i - 1])
      yieldStr = Math.max(ECalc * (epsCross - offset), 0)
      break
    }
  }
  if (yieldStr == null) {
    yieldStr = Math.max(...stresses.filter((_, i) => strains[i] >= offset), stresses[stresses.length - 1])
  }

  // 抗拉强度
  const tensile = Math.max(...stresses)

  // 延伸率
  const elongation = strains[strains.length - 1] * 100

  // 真实曲线
  const trueStrain = strains.map((e) => Math.log1p(Math.max(e, -0.999)))
  const trueStress = strains.map((e, i) => stresses[i] * (1 + Math.max(e, -0.999)))

  // 塑性应变
  const plasticStrain = trueStrain.map((et, i) => et - trueStress[i] / ECalc)

  // 颈缩点
  const neckingIdx = stresses.indexOf(tensile)

  // 屈服索引
  let yieldIdx = 0
  for (let i = 1; i < strains.length; i++) {
    const d0 = stresses[i - 1] - ECalc * (strains[i - 1] - offset)
    const d1 = stresses[i] - ECalc * (strains[i] - offset)
    if (d0 > 0 && d1 <= 0) { yieldIdx = i; break }
  }

  // n 值拟合 (Hollomon)
  let nVal: number | null = null
  let kVal: number | null = null
  const startFit = Math.max(yieldIdx, 1)
  const endFit = neckingIdx > startFit ? neckingIdx : plasticStrain.length
  const logEps: number[] = []
  const logSigma: number[] = []
  for (let i = startFit; i < endFit; i++) {
    if (plasticStrain[i] > 1e-5 && trueStress[i] > 0) {
      logEps.push(Math.log(plasticStrain[i]))
      logSigma.push(Math.log(trueStress[i]))
    }
  }
  if (logEps.length >= 3) {
    // 线性回归
    const m = logEps.length
    let sx = 0, sy = 0, sxy = 0, sxx = 0
    for (let i = 0; i < m; i++) {
      sx += logEps[i]; sy += logSigma[i]
      sxy += logEps[i] * logSigma[i]; sxx += logEps[i] * logEps[i]
    }
    const slope = (m * sxy - sx * sy) / (m * sxx - sx * sx || 1)
    const intercept = (sy - slope * sx) / m
    if (slope > 0 && slope < 1) {
      nVal = slope
      kVal = Math.exp(intercept)
    }
  }

  // r 值
  let rVal: number | null = null
  const validW = widths.map((w, i) => (!isNaN(w) ? i : -1)).filter((i) => i >= 0)
  if (validW.length >= 2) {
    // 插值补全
    const wInterp = strains.map((s) => {
      for (let i = 0; i < validW.length - 1; i++) {
        const i0 = validW[i], i1 = validW[i + 1]
        if (s >= strains[i0] && s <= strains[i1]) {
          const t = (s - strains[i0]) / (strains[i1] - strains[i0] || 1)
          return widths[i0] + t * (widths[i1] - widths[i0])
        }
      }
      return NaN
    })
    const tgtStrain = rStrain > strains[strains.length - 1] ? 0.8 * strains[strains.length - 1] : rStrain
    let wAt = NaN
    for (let i = 0; i < wInterp.length - 1; i++) {
      if (tgtStrain >= strains[i] && tgtStrain <= strains[i + 1] && !isNaN(wInterp[i])) {
        const t = (tgtStrain - strains[i]) / (strains[i + 1] - strains[i] || 1)
        wAt = wInterp[i] + t * (wInterp[i + 1] - wInterp[i])
        break
      }
    }
    if (!isNaN(wAt)) {
      const denom = tgtStrain + wAt
      if (Math.abs(denom) > 1e-12) rVal = -wAt / denom
    }
  }

  // 构建曲线
  const engineering: PointXY[] = strains.map((s, i) => ({ x: s, y: stresses[i] }))
  const trueCurve: PointXY[] = trueStrain.map((e, i) => ({ x: e, y: trueStress[i] }))
  const plastic: PointXY[] = plasticStrain
    .map((e, i) => ({ x: e, y: trueStress[i] }))
    .filter((p) => p.x > 0)

  const epsMax = strains[strains.length - 1]
  const yieldLine: PointXY[] = [
    { x: 0, y: -ECalc * offset },
    { x: epsMax, y: ECalc * (epsMax - offset) },
  ]

  let hardeningFit: PointXY[] = []
  if (nVal != null && kVal != null) {
    const epsMin = Math.max(
      ...plastic.filter((p) => p.x > 1e-4).map((p) => p.x),
      1e-4
    )
    const epsMaxP = Math.max(...plastic.map((p) => p.x), epsMin)
    const nPts = 50
    for (let i = 0; i < nPts; i++) {
      const e = epsMin + ((epsMaxP - epsMin) * i) / (nPts - 1)
      const s = kVal * Math.pow(e, nVal)
      if (isFinite(s)) hardeningFit.push({ x: e, y: s })
    }
  }

  const properties: MaterialProperties = {
    elastic_modulus: Number(ECalc.toFixed(1)),
    yield_strength: yieldStr != null ? Number(yieldStr.toFixed(2)) : null,
    tensile_strength: Number(tensile.toFixed(2)),
    elongation: Number(elongation.toFixed(2)),
    fracture_strain: Number(strains[strains.length - 1].toFixed(5)),
    n_value: nVal != null ? Number(nVal.toFixed(4)) : null,
    k_value: kVal != null ? Number(kVal.toFixed(2)) : null,
    r_value: rVal != null ? Number(rVal.toFixed(4)) : null,
  }

  const curves: CurveData = { engineering, true_curve: trueCurve, plastic, yield_line: yieldLine, hardening_fit: hardeningFit }

  return { properties, curves, message: '分析完成 (mock)' }
}
