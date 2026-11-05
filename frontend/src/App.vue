<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import DataImport from './components/DataImport.vue'
import CurveChart from './components/CurveChart.vue'
import ResultPanel from './components/ResultPanel.vue'
import { runTensileAnalysis } from './api'
import type { AnalysisRequest, AnalysisResponse } from './types'

const request = ref<AnalysisRequest>({
  data: [],
  elastic_modulus: null,
  yield_offset: 0.002,
  r_value_strain: 0.15,
})

const response = ref<AnalysisResponse | null>(null)
const loading = ref(false)

async function onAnalyze() {
  loading.value = true
  try {
    response.value = await runTensileAnalysis(request.value)
    ElMessage.success('分析完成')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.detail ?? '分析失败')
  } finally {
    loading.value = false
  }
}

function onRequestUpdate(req: AnalysisRequest) {
  request.value = req
}
</script>

<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <h1>力学数据分析软件</h1>
      <span class="subtitle">应力应变曲线分析 · 材料性能参数计算</span>
    </el-header>
    <el-container class="main-container">
      <el-aside width="340px" class="aside">
        <DataImport
          :loading="loading"
          @analyze="onAnalyze"
          @update:request="onRequestUpdate"
        />
      </el-aside>
      <el-main class="chart-main">
        <CurveChart :response="response" />
      </el-main>
      <el-aside width="320px" class="aside">
        <ResultPanel :response="response" />
      </el-aside>
    </el-container>
  </el-container>
</template>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
  font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
}
.app-container {
  height: 100vh;
}
.app-header {
  background: #1f2937;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
}
.app-header h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.app-header .subtitle {
  font-size: 13px;
  color: #9ca3af;
}
.main-container {
  height: calc(100vh - 56px);
}
.aside {
  background: #f3f4f6;
  border-right: 1px solid #e5e7eb;
  overflow-y: auto;
}
.chart-main {
  padding: 0;
  background: #111827;
  position: relative;
}
</style>
