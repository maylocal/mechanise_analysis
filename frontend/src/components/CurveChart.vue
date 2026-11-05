<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import type { AnalysisResponse, CurveData } from '../types'
import { sanitize, adaptiveFormat } from '../utils/curve'

const props = defineProps<{ response: AnalysisResponse | null }>()

const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null
let resizeTimer: number | null = null

/** 系列定义（颜色、线型与显示名称集中管理，便于条件渲染）。 */
interface SeriesDef {
  key: keyof CurveData
  name: string
  color: string
  dashed?: boolean
  /** 数据是否需要按 x 排序（线类需要；偏移线为两点不必排序）。 */
  sort?: boolean
}

const SERIES_DEFS: SeriesDef[] = [
  { key: 'engineering', name: '工程应力-应变', color: '#60a5fa', sort: true },
  { key: 'true_curve', name: '真实应力-应变', color: '#34d399', sort: true },
  { key: 'plastic', name: '塑性应变-真实应力', color: '#fbbf24', sort: true },
  { key: 'yield_line', name: '屈服偏移线', color: '#f87171', dashed: true },
  { key: 'hardening_fit', name: 'Hollomon 拟合', color: '#a78bfa', dashed: true, sort: true },
]

function buildOption(curves: CurveData) {
  // 构建条件系列：仅包含有数据的系列
  const series = SERIES_DEFS.map((def) => {
    const data = sanitize(curves[def.key], def.sort)
    return { def, data }
  })
    .filter((s) => s.data.length > 0)
    .map((s) => ({
      name: s.def.name,
      type: 'line' as const,
      showSymbol: false,
      smooth: false,
      data: s.data,
      lineStyle: {
        width: s.def.dashed ? 1.5 : 2,
        color: s.def.color,
        type: s.def.dashed ? ('dashed' as const) : ('solid' as const),
      },
      // 空数据时 ECharts 仍需入口以保持图例一致，但此处已过滤空系列
      connectNulls: false,
    }))

  const legendData = series.map((s) => s.name)

  // 计算 x/y 范围以便设置合理 boundaryGap
  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  for (const s of series) {
    for (const [x, y] of s.data) {
      if (x < xMin) xMin = x
      if (x > xMax) xMax = x
      if (y < yMin) yMin = y
      if (y > yMax) yMax = y
    }
  }
  const hasRange = Number.isFinite(xMin) && Number.isFinite(xMax) && xMax > xMin
  const hasYRange = Number.isFinite(yMin) && Number.isFinite(yMax) && yMax > yMin

  return {
    title: { text: '应力-应变曲线', left: 'center', textStyle: { color: '#e5e7eb', fontSize: 14 } },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: { color: '#e5e7eb' },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return ''
        const header = `应变 = ${adaptiveFormat(params[0].axisValue)}`
        const lines = params
          .map((p: any) => {
            const v = Array.isArray(p.data) ? p.data[1] : p.data
            return `${p.marker} ${p.seriesName}: <b>${adaptiveFormat(Number(v))}</b> MPa`
          })
          .join('<br/>')
        return `${header}<br/>${lines}`
      },
    },
    legend: {
      data: legendData,
      top: 30,
      textStyle: { color: '#9ca3af' },
    },
    grid: { left: 70, right: 30, top: 80, bottom: 70, containLabel: false },
    xAxis: {
      type: 'value',
      name: '应变',
      nameTextStyle: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#4b5563' } },
      axisLabel: {
        color: '#9ca3af',
        formatter: (v: number) => adaptiveFormat(Number(v)),
      },
      splitLine: { lineStyle: { color: '#1f2937' } },
      // 数据范围两端留 5% 余白，避免顶到坐标轴
      min: hasRange ? xMin - (xMax - xMin) * 0.05 : undefined,
      max: hasRange ? xMax + (xMax - xMin) * 0.05 : undefined,
    },
    yAxis: {
      type: 'value',
      name: '应力 (MPa)',
      nameTextStyle: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#4b5563' } },
      axisLabel: {
        color: '#9ca3af',
        formatter: (v: number) => adaptiveFormat(Number(v)),
      },
      splitLine: { lineStyle: { color: '#1f2937' } },
      min: hasYRange ? yMin - (yMax - yMin) * 0.05 : undefined,
      max: hasYRange ? yMax + (yMax - yMin) * 0.05 : undefined,
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      { type: 'slider', xAxisIndex: 0, height: 18, bottom: 20, textStyle: { color: '#9ca3af' } },
    ],
    series,
  }
}

function ensureChart(): boolean {
  if (chart) return true
  if (!chartRef.value) return false
  // 容器必须已布局完成且有尺寸，否则 ECharts 会发出 DOM width/height 警告
  if (chartRef.value.offsetWidth === 0 || chartRef.value.offsetHeight === 0) {
    return false
  }
  try {
    chart = echarts.init(chartRef.value, 'dark')
    window.addEventListener('resize', onResize)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => safeResize())
      resizeObserver.observe(chartRef.value)
    }
    return true
  } catch (e) {
    console.error('[CurveChart] 初始化失败:', e)
    return false
  }
}

function render() {
  if (!chart) return
  if (!props.response || !props.response.curves) {
    try {
      chart.clear()
    } catch {
      /* 忽略 dispose 后调用 */
    }
    return
  }
  try {
    chart.setOption(buildOption(props.response.curves), true)
  } catch (e) {
    // 渲染失败不应使整个组件崩溃
    console.error('[CurveChart] setOption 失败:', e)
  }
}

function safeResize() {
  if (!chart) return
  if (resizeTimer != null) {
    window.clearTimeout(resizeTimer)
  }
  resizeTimer = window.setTimeout(() => {
    try {
      chart?.resize()
    } catch (e) {
      console.error('[CurveChart] resize 失败:', e)
    }
  }, 120)
}

function onResize() {
  safeResize()
}

onMounted(async () => {
  await nextTick()
  // 不在 mount 时立即初始化：当 response 为空时容器被 v-show 隐藏，
  // 此时 init 会导致 ECharts 拿到 0 尺寸。改为首次有数据时延迟初始化。
  if (props.response) {
    ensureChart()
    render()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (resizeTimer != null) window.clearTimeout(resizeTimer)
  resizeObserver?.disconnect()
  resizeObserver = null
  try {
    chart?.dispose()
  } catch {
    /* 已销毁 */
  }
  chart = null
})

// 当 response 变化后，等待 DOM 更新再渲染，避免容器尺寸为 0
watch(
  () => props.response,
  async () => {
    await nextTick()
    // 容器可能刚从 v-show 切换显示，需多等一帧确保尺寸已就绪
    if (chartRef.value && chartRef.value.offsetWidth === 0) {
      await new Promise((r) => requestAnimationFrame(r))
      await nextTick()
    }
    if (ensureChart()) {
      render()
      safeResize()
    }
  },
  { deep: true }
)
</script>

<template>
  <div class="chart-wrapper">
    <div v-if="!response" class="empty">
      <p>暂无数据</p>
      <p class="hint">导入或选择样例数据后开始分析</p>
    </div>
    <div ref="chartRef" class="chart-container" v-show="response"></div>
  </div>
</template>

<style scoped>
.chart-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}
.chart-container {
  width: 100%;
  height: 100%;
}
.empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #6b7280;
}
.empty .hint {
  font-size: 12px;
  margin-top: 6px;
}
</style>
