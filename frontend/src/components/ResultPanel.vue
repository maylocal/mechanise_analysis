<script setup lang="ts">
import { computed } from 'vue'
import type { AnalysisResponse, MaterialProperties } from '../types'

const props = defineProps<{ response: AnalysisResponse | null }>()

const items = computed<{ label: string; value: string; unit: string; highlight?: boolean }[]>(() => {
  if (!props.response) return []
  const p = props.response.properties as MaterialProperties
  const fmt = (v: number | null | undefined, d = 2) =>
    v == null ? '—' : Math.abs(v) > 1e5 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(3) : v.toFixed(d)
  return [
    { label: '弹性模量 E', value: fmt(p.elastic_modulus, 1), unit: 'MPa' },
    { label: '屈服强度 Rp0.2', value: fmt(p.yield_strength), unit: 'MPa', highlight: true },
    { label: '抗拉强度 Rm', value: fmt(p.tensile_strength), unit: 'MPa', highlight: true },
    { label: '延伸率 A', value: fmt(p.elongation), unit: '%', highlight: true },
    { label: '断裂应变', value: fmt(p.fracture_strain, 4), unit: '' },
    { label: '硬化指数 n', value: fmt(p.n_value, 4), unit: '', highlight: true },
    { label: '强度系数 K', value: fmt(p.k_value), unit: 'MPa' },
    { label: '塑性应变比 r', value: fmt(p.r_value, 4), unit: '', highlight: true },
  ]
})
</script>

<template>
  <div class="result-panel">
    <div v-if="!response" class="empty-state">
      <p>尚未分析</p>
      <p class="hint">导入数据后点击"开始分析"</p>
    </div>

    <template v-else>
      <div class="section">
        <h3>材料力学性能</h3>
        <div class="prop-list">
          <div
            v-for="it in items"
            :key="it.label"
            class="prop-item"
            :class="{ highlight: it.highlight }"
          >
            <div class="prop-label">{{ it.label }}</div>
            <div class="prop-value">
              <span class="num">{{ it.value }}</span>
              <span class="unit">{{ it.unit }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>分析说明</h3>
        <ul class="notes">
          <li><b>屈服强度</b>：0.2% 偏移法</li>
          <li><b>抗拉强度</b>：工程应力最大值</li>
          <li><b>n 值</b>：Hollomon 方程均匀塑性段拟合</li>
          <li><b>r 值</b>：基于体积不可压缩假设，需横向应变数据</li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
.result-panel {
  padding: 16px;
}
.empty-state {
  text-align: center;
  padding: 40px 16px;
  color: #9ca3af;
}
.empty-state p {
  margin: 4px 0;
}
.empty-state .hint {
  font-size: 12px;
}
.section {
  margin-bottom: 18px;
}
.section h3 {
  font-size: 13px;
  color: #374151;
  margin: 0 0 8px 0;
  font-weight: 600;
}
.prop-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}
.prop-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 8px 12px;
}
.prop-item.highlight {
  border-color: #93c5fd;
  background: #eff6ff;
}
.prop-label {
  font-size: 12px;
  color: #6b7280;
}
.prop-value {
  display: flex;
  align-items: baseline;
  gap: 3px;
}
.prop-value .num {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}
.prop-value .unit {
  font-size: 11px;
  color: #9ca3af;
}
.notes {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  color: #4b5563;
  line-height: 1.8;
}
.notes b {
  color: #1f2937;
}
</style>
