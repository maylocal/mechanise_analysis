# 力学数据分析软件 (Mechanics Data Analysis)

以**力学数据分析**为核心的 Web 应用：导入应力应变数据，自动生成应力应变曲线，并计算材料力学性能参数（屈服强度、抗拉强度、延伸率、应变硬化指数 n 值、塑性应变比 r 值）。

## 核心功能

- **数据导入**：支持工程应力-应变数据导入（CSV / 手动录入 / 预设样例）
- **曲线生成**：
  - 工程应力-应变曲线
  - 真实应力-应变曲线
  - 塑性应变-真实应力曲线（n 值拟合用）
  - 0.2% 偏移线（屈服判定）
  - Hollomon 拟合曲线
- **性能参数计算**：
  - **弹性模量 E**：自动识别线性段拟合
  - **屈服强度 Rp0.2**：0.2% 偏移法
  - **抗拉强度 Rm**：工程应力最大值
  - **延伸率 A**：断裂工程应变（%）
  - **n 值**：Hollomon 方程 σ = K·ε^n 均匀塑性段对数拟合
  - **r 值**：塑性应变比 r = ε_w / ε_t（需横向应变数据）

## 技术栈

### 后端
- **FastAPI** — 异步 Web 框架
- **NumPy / SciPy** — 数据计算与曲线拟合
- **Pydantic** — 数据校验

### 前端
- **Vue 3 + TypeScript** — 响应式 UI
- **ECharts** — 数据可视化图表
- **Element Plus** — UI 组件库
- **Vite** — 构建工具

## 目录结构

```
mechanics-analysis/
├── backend/                       # 后端服务
│   ├── app/
│   │   ├── main.py                # FastAPI 入口
│   │   ├── config.py              # 配置
│   │   ├── api/routes/
│   │   │   ├── analysis.py        # 拉伸性能分析接口
│   │   │   └── data.py            # 样例数据接口
│   │   └── core/
│   │       ├── schemas.py         # 数据模型
│   │       └── analysis/          # 数据分析核心
│   │           ├── curve.py       # 工程曲线/真实曲线转换
│   │           ├── properties.py  # 屈服/抗拉/延伸率
│   │           ├── hardening.py   # n 值（Hollomon 拟合）
│   │           └── anisotropy.py  # r 值
│   └── requirements.txt
├── frontend/                      # 前端应用
│   ├── src/
│   │   ├── components/
│   │   │   ├── DataImport.vue     # 数据导入面板
│   │   │   ├── CurveChart.vue     # 应力应变曲线图
│   │   │   └── ResultPanel.vue    # 性能结果面板
│   │   ├── api/                   # 接口封装
│   │   ├── types/                 # 类型定义
│   │   └── App.vue
│   └── package.json
└── README.md
```

## 计算原理

### 弹性模量 E
取应力应变曲线初始线性段（低应变区），最小二乘法拟合斜率。

### 屈服强度 Rp0.2
过应变 ε = 0.2% 作弹性斜率平行线，与曲线交点对应的应力值。

### 抗拉强度 Rm
工程应力-应变曲线的最大应力值。

### 延伸率 A
断裂时的工程应变（百分比）。

### 应变硬化指数 n
Hollomon 方程 σ = K·ε^n，取均匀塑性变形段（屈服至颈缩前），对真实应力 σ_t 与塑性应变 ε_p 取对数后线性拟合，斜率即 n：
- 真实应力 σ_t = σ_e(1 + ε_e)
- 真实应变 ε_t = ln(1 + ε_e)
- 塑性应变 ε_p = ε_t − σ_t / E

### 塑性应变比 r
基于体积不可压缩假设 ε_a + ε_w + ε_t = 0：
- r = ε_w / ε_t = −ε_w / (ε_a + ε_w)
- 取均匀塑性变形阶段的横向（宽度）应变与轴向应变计算

## 快速开始

### 后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173 即可使用。

## API 文档

启动后端后访问 http://localhost:8000/docs 查看 Swagger 文档。
