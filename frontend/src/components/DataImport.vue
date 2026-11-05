<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadRawFile } from 'element-plus'
import { listSamples, loadSample } from '../api'
import type { AnalysisRequest, DataPoint } from '../types'

defineProps<{ loading: boolean }>()
const emit = defineEmits<{
  (e: 'analyze'): void
  (e: 'update:request', req: AnalysisRequest): void
}>()

const request = ref<AnalysisRequest>({
  data: [],
  elastic_modulus: null,
  yield_offset: 0.002,
  r_value_strain: 0.15,
})

const samples = ref<string[]>([])
const selectedSample = ref('')
const hasWidthStrain = ref(false)

async function refreshSamples() {
  try {
    samples.value = await listSamples()
  } catch {
    samples.value = ['low_carbon_steel', 'aluminum_alloy', 'high_strength_steel']
  }
}
refreshSamples()

async function onSampleChange(name: string) {
  if (!name) return
  try {
    const ds = await loadSample(name)
    request.value.data = ds.data
    hasWidthStrain.value = ds.data.some((p) => p.width_strain != null)
    emit('update:request', request.value)
    ElMessage.success(`已加载: ${ds.name}`)
  } catch {
    ElMessage.error('加载样例失败')
  }
}

function parseCSV(text: string): DataPoint[] {
  const lines = text.trim().split(/\r?\n/)
  const points: DataPoint[] = []
  let start = 0
  // 检测表头
  const first = lines[0].split(/[,\t;]/).map((s) => s.trim().toLowerCase())
  if (first.some((f) => /strain|stress|应变|应力/.test(f))) start = 1

  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(/[,\t;]/).map((s) => s.trim())
    if (cols.length < 2) continue
    const strain = parseFloat(cols[0])
    const stress = parseFloat(cols[1])
    if (isNaN(strain) || isNaN(stress)) continue
    const w = cols.length >= 3 ? parseFloat(cols[2]) : NaN
    points.push({
      strain,
      stress,
      width_strain: isNaN(w) ? null : w,
    })
  }
  return points
}

function onFileChange(file: { raw: UploadRawFile }) {
  const reader = new FileReader()
  reader.onload = () => {
    const points = parseCSV(String(reader.result || ''))
    if (points.length < 5) {
      ElMessage.error('CSV 数据点不足')
      return
    }
    request.value.data = points
    hasWidthStrain.value = points.some((p) => p.width_strain != null)
    emit('update:request', request.value)
    ElMessage.success(`已导入 ${points.length} 个数据点`)
  }
  reader.readAsText(file.raw)
}

watch(request, (val) => emit('update:request', val), { deep: true })

function onAnalyze() {
  emit('update:request', request.value)
  emit('analyze')
}
</script>

<template>
  <div class="import-panel">
    <div class="section">
      <h3>数据来源</h3>
      <el-select
        v-model="selectedSample"
        placeholder="选择样例数据集"
        style="width: 100%; margin-bottom: 10px"
        @change="onSampleChange"
      >
        <el-option
          v-for="s in samples"
          :key="s"
          :label="s"
          :value="s"
        />
      </el-select>
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        accept=".csv,.txt"
        :on-change="onFileChange as any"
      >
        <el-button style="width: 100%">导入 CSV 文件</el-button>
      </el-upload>
      <p class="tip">CSV 格式：应变, 应力[, 横向应变]</p>
    </div>

    <div class="section">
      <h3>分析参数</h3>
      <el-form label-position="top" size="small">
        <el-form-item label="弹性模量 E (MPa)">
          <el-input-number
            v-model="request.elastic_modulus"
            :min="0"
            :placeholder="'留空自动拟合'"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="屈服偏移量">
          <el-input-number
            v-model="request.yield_offset"
            :min="0"
            :step="0.001"
            :precision="4"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="r 值目标应变">
          <el-input-number
            v-model="request.r_value_strain"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="3"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
    </div>

    <div class="section">
      <div class="section-header">
        <h3>数据点 ({{ request.data.length }})</h3>
        <el-tag v-if="hasWidthStrain" type="success" size="small">含横向应变</el-tag>
      </div>
      <div class="data-list">
        <div class="data-row data-head">
          <span>序号</span>
          <span>应变</span>
          <span>应力(MPa)</span>
        </div>
        <div v-for="(p, i) in request.data.slice(0, 50)" :key="i" class="data-row">
          <span>{{ i }}</span>
          <span>{{ p.strain.toExponential(2) }}</span>
          <span>{{ p.stress.toFixed(1) }}</span>
        </div>
        <div v-if="request.data.length > 50" class="more">
          ... 共 {{ request.data.length }} 个点
        </div>
        <div v-if="!request.data.length" class="empty">暂无数据</div>
      </div>
    </div>

    <div class="actions">
      <el-button
        type="primary"
        :loading="loading"
        :disabled="request.data.length < 5"
        style="width: 100%"
        @click="onAnalyze"
      >
        开始分析
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.import-panel {
  padding: 16px;
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
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.tip {
  font-size: 11px;
  color: #9ca3af;
  margin: 6px 0 0 0;
}
.data-list {
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  max-height: 200px;
  overflow-y: auto;
}
.data-row {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1.4fr;
  padding: 5px 10px;
  font-size: 12px;
  border-bottom: 1px solid #f3f4f6;
}
.data-row:last-child {
  border-bottom: none;
}
.data-head {
  font-weight: 600;
  color: #6b7280;
  background: #f9fafb;
}
.more {
  padding: 8px;
  text-align: center;
  color: #9ca3af;
  font-size: 12px;
}
.empty {
  padding: 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 12px;
}
.actions {
  margin-top: 8px;
}
</style>
