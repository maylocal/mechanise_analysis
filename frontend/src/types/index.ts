/** 数据类型定义，与后端 schemas 对应。 */

export interface DataPoint {
  strain: number
  stress: number
  width_strain?: number | null
}

export interface AnalysisRequest {
  data: DataPoint[]
  elastic_modulus?: number | null
  yield_offset?: number
  r_value_strain?: number
}

export interface PointXY {
  x: number
  y: number
}

export interface CurveData {
  engineering: PointXY[]
  true_curve: PointXY[]
  plastic: PointXY[]
  yield_line: PointXY[]
  hardening_fit: PointXY[]
}

export interface MaterialProperties {
  elastic_modulus?: number | null
  yield_strength?: number | null
  tensile_strength?: number | null
  elongation?: number | null
  fracture_strain?: number | null
  n_value?: number | null
  k_value?: number | null
  r_value?: number | null
}

export interface AnalysisResponse {
  properties: MaterialProperties
  curves: CurveData
  message: string
}

export interface SampleDataset {
  name: string
  description: string
  data: DataPoint[]
}
