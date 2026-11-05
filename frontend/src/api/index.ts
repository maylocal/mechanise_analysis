/** 后端 API 封装 — 网络失败时回退到本地 mock。 */
import axios from 'axios'
import type { AnalysisRequest, AnalysisResponse, SampleDataset } from '../types'
import { getMockAnalysis, getMockSample, getMockSampleNames } from './mock'

const http = axios.create({
  baseURL: '/api',
  timeout: 3000,
})

/** 执行拉伸性能分析。 */
export async function runTensileAnalysis(req: AnalysisRequest): Promise<AnalysisResponse> {
  try {
    const { data } = await http.post<AnalysisResponse>('/analysis/tensile', req)
    return data
  } catch {
    return getMockAnalysis(req)
  }
}

/** 获取样例数据集列表。 */
export async function listSamples(): Promise<string[]> {
  try {
    const { data } = await http.get<{ samples: string[] }>('/data/samples')
    return data.samples
  } catch {
    return getMockSampleNames()
  }
}

/** 加载指定样例数据集。 */
export async function loadSample(name: string): Promise<SampleDataset> {
  try {
    const { data } = await http.get<SampleDataset>(`/data/samples/${name}`)
    return data
  } catch {
    const ds = getMockSample(name)
    if (!ds) throw new Error(`样例数据集 ${name} 不存在`)
    return ds
  }
}
