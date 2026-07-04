# VASP GUI Web — 科学计算可视化平台

基于 Web 架构的 VASP 科学计算可视化平台，为材料科学研究者提供**浏览器端的 VASP 计算全流程管理**。

## 这是什么

VASP GUI 是一个 **Web 界面**，让你通过浏览器连接远程超算集群，完成 VASP 第一性原理计算的**全流程操作**：

1. **连接集群** — 通过 SSH 连接到远程超算登录节点，浏览文件、执行命令
2. **编辑输入文件** — 可视化表单编辑 INCAR/KPOINTS/POSCAR 等 VASP 输入文件，双击即可改参数
3. **一键提交计算** — 从 95 种预设模板中选择计算类型（结构优化/DOS/能带/NEB/声子...），自动生成输入文件并提交
4. **实时监控** — 右侧面板实时显示 VASP 输出、能量收敛曲线、离子步/电子步进度
5. **后处理分析** — 交互式 ECharts 图表查看 DOS 态密度、能带结构、能量收敛、光学性质
6. **3D 结构查看** — Three.js 渲染晶体结构，支持旋转/缩放/平移

**核心理念**：不需要在本地安装任何科学计算软件，不需要记 VASP 参数名，打开浏览器就能完成从输入文件准备到结果分析的全部工作。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | FastAPI (Python 3.11+) |
| 前端框架 | React 18 + TypeScript |
| UI 组件库 | Ant Design 5 |
| 代码编辑器 | Monaco Editor |
| 终端模拟 | xterm.js |
| 图表渲染 | ECharts 5 |
| SSH 通信 | asyncssh |
| 材料科学 | pymatgen (fallback: 正则解析) |
| 数据库 | SQLite (开发) / PostgreSQL (生产) |
| 部署 | Docker + Nginx |

## 快速开始

### 环境要求

- Python >= 3.11
- Node.js >= 18.0.0
- Docker >= 24.0.0 (生产部署)

### 安装依赖

```bash
# 后端
cd backend
pip install -r requirements.txt

# 前端
cd frontend
npm install
```

### 开发模式

```bash
# 方式1: 单端口运行（推荐）
cd backend && python main.py
# 浏览器访问 http://localhost:1691（后端同时提供前端静态文件）

# 方式2: 前后端分离（前端热重载）
# 终端1: cd backend && python main.py      (后端 1691)
# 终端2: cd frontend && npm run dev        (前端 5173)
```
首次启动会自动生成 `backend/config.yaml` 配置文件。

### Docker 部署

```bash
docker-compose up -d
```

访问 `http://localhost`。

## 功能

### ✅ 已实现
- **多服务器节点管理** — 可视化 SSH 连接，AES 加密存储凭据
- **自由工作区** — 无目录限制的远程文件浏览，嵌入式终端
- **双向终端** — WebSocket PTY 可交互 shell (xterm.js)
- **文件操作** — 右键菜单 (复制/粘贴/重命名/删除/下载)，文件上传
- **VASP 文件查看器** — INCAR/KPOINTS/POSCAR/POTCAR/OUTCAR/OSZICAR 可视化
- **双态编辑器** — INCAR 可视化表单 + Monaco 源码编辑器，双击编辑
- **INCAR 标签注册表** — 70+ 标签含中文描述、分类、依赖
- **95 种计算模板** — 15 大类全覆盖 VASP 计算类型，可搜索
- **实时任务提交与监控** — 一键提交 + WebSocket 实时终端输出 + 能量收敛图
- **双层进度条** — 离子步/电子步实时进度 + 能量显示 + 收敛检测
- **后处理分析** — DOS 态密度 / 能带结构 / 能量收敛 / 光学性质 交互式 ECharts 图表
- **3D 晶体结构预览** — Three.js 渲染 POSCAR，旋转/缩放/平移，球棍模型
- **国际化** — 中英双语 (220+ keys)
- **Docker 生产部署** — docker-compose + Nginx 反向代理 + WebSocket 代理
- **后端测试套件** — pytest 单元测试覆盖所有 VASP 解析器
- **自动重连** — 刷新页面自动连接上次服务器和工作目录

## 项目结构

```
├── README.md                 # 本文件
├── docker-compose.yml        # Docker 部署配置
├── Dockerfile                # 后端 Docker 镜像
├── nginx.conf                # Nginx 反向代理
├── Makefile                  # 开发/构建快捷命令
├── backend/                  # FastAPI 后端
│   ├── main.py               # 应用入口 (WebSocket + SPA 托管)
│   ├── config.yaml           # 自动生成的配置文件
│   ├── requirements.txt      # Python 依赖清单
│   ├── data/                 # SQLite 数据库文件
│   └── app/
│       ├── config.py         # 全局配置加载
│       ├── database.py       # SQLAlchemy 引擎
│       ├── middleware.py     # 速率限制中间件
│       ├── api/              # REST API 路由
│       ├── ws/               # WebSocket 路由
│       ├── models/           # 数据库 ORM 模型
│       ├── schemas/          # Pydantic 请求/响应 Schema
│       ├── services/         # 业务逻辑层
│       └── utils/            # 工具函数
└── frontend/                 # React 前端
    ├── index.html
    ├── package.json
    └── src/
        ├── main.tsx          # React 入口
        ├── App.tsx           # 根组件 (路由 + 主题)
        ├── i18n.ts           # 国际化 (220+ keys 中英双语)
        ├── api/              # API 调用层
        ├── store/            # Zustand 状态管理
        ├── hooks/            # 自定义 Hooks
        ├── types/            # TypeScript 类型定义
        ├── styles/           # 样式
        └── components/
            ├── layout/       # 布局组件
            ├── left-panel/   # 左侧面板
            ├── center-panel/ # 中间面板
            ├── right-panel/  # 右侧面板
            ├── dialogs/      # 对话框
            └── postprocess/  # 后处理图表
```

## API 端点一览

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/refresh` | 刷新 JWT |
| GET/POST/PUT/DELETE | `/api/servers` | 服务器 CRUD |
| POST | `/api/servers/{id}/test` | 测试 SSH 连接 |
| GET | `/api/files/{alias}` | 列出远程目录 |
| GET/POST | `/api/files/{alias}/read` / `write` | 读写远程文件 |
| POST | `/api/files/{alias}/upload` / `download` | 上传/下载文件 |
| POST | `/api/files/{alias}/rename` / `copy` | 重命名/复制 |
| GET/POST | `/api/presets` | 计算模板/预设 |
| GET | `/api/config` | 读取配置 |
| GET | `/api/vasp/tags` | INCAR 标签注册表 |
| POST | `/api/vasp/parse/*` | 解析 VASP 文件 |
| POST | `/api/jobs/submit` | 提交 VASP 任务 |
| GET | `/api/jobs/{id}/status` | 查询任务状态 |
| WS | `/ws/terminal/{alias}` | 双向 PTY 终端 |
| WS | `/ws/console/{job_id}` | VASP 终端输出流 |
| WS | `/ws/chart/{job_id}` | 能量收敛数据推送 |
| WS | `/ws/status/{alias}` | 节点状态推送 |

## 配置

首次启动在 `backend/config.yaml` 自动生成配置文件：

- `web.port` — 后端监听端口 (默认 1691)
- `admin.password` — 留空 = 免密登录，设置后需密码
- `servers` — 预设服务器列表 (可在 Web 界面管理)
- `defaults.vasp_command` — 默认 VASP 执行文件
- `cors_origins` — CORS 允许来源 (默认 *)

## 许可证

MIT License
