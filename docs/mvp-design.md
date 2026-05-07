# Agent Console MVP 版本设计文档

## 一、项目定位

**Agent Console** 是一个面向 AI Agent 的控制台和工作台，核心价值是让 Agent 执行过程**可见、可控、可审计、可恢复**。

它不是普通聊天框，也不是传统 CRUD 后台，而是一个用于观察、控制、审批、恢复和审计 Agent 执行过程的实时操作台。

---

## 二、目标用户

| 用户类型 | 描述 |
|---------|------|
| 开发者 | 使用 Agent 读、写、运行代码 |
| AI 应用构建者 | 需要调试 Agent 工作流 |
| 内部平台团队 | 构建受控的 Agent 执行环境 |
| 安全/合规审查 | 检查工具调用审计追踪 |
| 团队负责人 | 监控使用量、成本和失败模式 |

---

## 三、MVP 功能清单

### 3.1 核心功能（Must Have）

| 功能模块 | 功能点 | 优先级 | 说明 |
|---------|--------|--------|------|
| **会话管理** | 会话列表浏览 | P0 | 展示历史会话，支持搜索 |
| | 会话创建与恢复 | P0 | 支持断线重连后恢复 |
| **Agent 对话** | 用户输入任务 | P0 | 输入框支持多行任务描述 |
| | 模型流式输出 | P0 | SSE 实时接收 token |
| | 运行状态展示 | P0 | started/running/completed/failed/cancelled |
| **Run Timeline** | 时间线展示 | P0 | 展示 model call、tool call、approval、error |
| | 步骤进度 | P0 | 每个 step 的状态变化 |
| **Tool Call Inspector** | 工具列表 | P0 | 展示所有 tool call 记录 |
| | 工具详情 | P0 | 名称、参数、结果、错误、耗时、风险级别 |
| **人工审批** | 审批卡片 | P0 | 展示待审批的 tool call |
| | Approve | P0 | 批准执行 |
| | Reject | P0 | 拒绝执行 |
| | Edit & Approve | P1 | 修改参数后执行 |
| | 审批理由 | P1 | 记录决策原因 |
| **日志面板** | 结构化日志 | P0 | 级别、时间戳、日志内容 |
| | 日志搜索过滤 | P1 | 支持关键词和级别过滤 |
| **文件 Diff** | 文件列表 | P0 | 展示 Agent 修改的文件 |
| | Diff 预览 | P0 | 展示修改内容 |
| **持久化存储** | Messages 持久化 | P0 | 保存对话消息 |
| | Runs 持久化 | P0 | 保存运行记录 |
| | Tool Calls 持久化 | P0 | 保存工具调用记录 |
| | Approvals 持久化 | P0 | 保存审批记录 |
| | Artifacts 持久化 | P0 | 保存文件和产物 |
| **审计记录** | 敏感操作日志 | P0 | 记录 approve/reject/edit 操作 |
| | 审计查询 | P1 | 按时间、用户、操作类型查询 |

### 3.2 增强功能（Should Have）

| 功能模块 | 功能点 | 优先级 | 说明 |
|---------|--------|--------|------|
| **断线重连** | 状态恢复 | P1 | 刷新页面后恢复 active run |
| **Token 统计** | Token 用量 | P1 | 展示本次 run 的 token 消耗 |
| **成本估算** | 费用计算 | P1 | 基于 token 数估算成本 |
| **认证鉴权** | 用户登录 | P1 | 基础认证 |
| | 项目权限 | P2 | 项目级访问控制 |

### 3.3 暂不做（Not MVP）

- 企业级多租户计费
- 插件市场
- 复杂 DAG 工作流编辑器
- 完整 IDE
- 高级多 Agent 可视化编排
- 完整 RBAC 权限矩阵
- 自研完整 observability 平台
- Tauri 桌面端

---

## 四、技术栈

### 4.1 Web MVP 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| **前端框架** | Next.js + React | App Router 模式 |
| **语言** | TypeScript | 类型安全 |
| **样式** | Tailwind CSS + shadcn/ui | 快速构建 UI |
| **状态管理** | TanStack Query | 服务端状态 |
| | Zustand | 客户端状态 |
| **代码编辑器** | Monaco Editor | Diff 查看 |
| **实时通信** | SSE | 服务端推送流式输出 |
| | WebSocket | 双向控制（审批、取消） |
| **后端框架** | FastAPI | Python 高性能 API |
| **Agent 运行时** | Python + LangGraph | Agent 核心逻辑 |
| **数据库** | PostgreSQL | 结构化数据存储 |
| **缓存/队列** | Redis | 队列、缓存、回话协调 |
| **可观测性** | OpenTelemetry | Event Model 兼容 |

### 4.2 技术架构图

```
+-----------------------+
| Web Client            |
| Next.js / React       |
+-----------+-----------+
            |
            | REST / SSE / WebSocket
            |
+-----------v-----------+
| API Service           |
| FastAPI               |
+-----------+-----------+
            |
            | enqueue / resume / control
            |
+-----------v-----------+
| Agent Runtime Worker  |
| Python / LangGraph    |
+-----------+-----------+
            |
            | tools / files / models
            |
+-----------v-----------+
| Tool Gateway          |
| Permissions + Audit   |
+-----------------------+

+-----------------------+
| PostgreSQL            |
| Runs / messages /     |
| tool calls / approvals|
+-----------------------+

+-----------------------+
| Redis                 |
| queues / pubsub /     |
| active run state      |
+-----------------------+
```

---

## 五、信息架构

### 5.1 页面清单

| 页面 | 作用 |
|------|------|
| Console | Agent 对话、运行控制、实时状态 |
| Runs | 历史 run 和当前 active run |
| Approval Inbox | 集中处理待审批工具调用 |
| Files | 文件树、产物、diff |
| Trace | latency、tokens、cost、span、error |
| Audit Log | 敏感操作和审批记录 |
| Settings | 模型、工具权限、环境变量、system prompt |

### 5.2 界面布局

```
+------------------------------------------------+
| Project / Model / Run Status / Controls         |
+--------------+-----------------+---------------+
| Sessions     | Conversation    | Inspector     |
| Runs         | Agent Stream    | Tool Calls    |
| Tasks        | Human Prompts   | Files / Diff  |
+--------------+-----------------+---------------+
| Timeline / Logs / Trace / Token Usage           |
+------------------------------------------------+
```

---

## 六、核心数据模型

### 6.1 核心表

| 表名 | 用途 |
|------|------|
| users | 用户信息 |
| projects | 项目 |
| sessions | 会话 |
| runs | 运行记录 |
| messages | 对话消息 |
| agent_steps | Agent 步骤 |
| tool_calls | 工具调用 |
| approval_requests | 审批请求 |
| run_events | 运行事件 |
| files | 文件 |
| file_diffs | 文件差异 |
| artifacts | 产物 |
| audit_logs | 审计日志 |

### 6.2 关键字段

**runs**
- id, project_id, session_id, status
- started_by, started_at, completed_at
- model, total_tokens, estimated_cost

**tool_calls**
- id, run_id, step_id, tool_name
- arguments_json, result_json, status
- risk_level, required_permission
- started_at, completed_at, error_message

**approval_requests**
- id, run_id, tool_call_id, status
- original_args_json, edited_args_json
- decision, decision_reason, decided_by, decided_at

**audit_logs**
- id, project_id, actor_id, action
- target_type, target_id, metadata_json, created_at

---

## 七、人工审批流程

### 7.1 工具策略声明

```json
{
  "name": "delete_file",
  "risk_level": "high",
  "required_permission": "file.write",
  "approval_policy": "always",
  "args_schema": {},
  "preview_supported": true,
  "rollback_supported": false
}
```

### 7.2 审批决策

| 决策 | 行为 |
|------|------|
| Approve | 按原参数执行 |
| Edit & Approve | 修改参数后执行 |
| Reject | 拒绝执行，把反馈返回给 Agent |

### 7.3 默认需要审批的操作

- 修改或删除文件
- 执行 shell 命令
- 访问密钥或环境变量
- 查询生产数据库
- 写入外部系统
- 删除数据
- 发起网络请求到敏感服务

---

## 八、实时通信设计

### 8.1 SSE（服务端推送）

适用场景：
- LLM token streaming
- Agent step events
- Tool call 状态变化
- 日志事件
- Run 状态变化

接口：`GET /api/runs/{run_id}/events`

### 8.2 WebSocket（双向控制）

适用场景：
- Cancel run
- Approve tool call
- Reject tool call
- Edit tool call arguments

### 8.3 Event Types

```
run.started
message.created / message.delta / message.completed
step.started
tool_call.created / tool_call.pending_approval / tool_call.started / tool_call.completed / tool_call.failed
approval.created / approval.resolved
file_diff.created
log.created
run.completed / run.failed / run.cancelled
```

---

## 九、进度排期

### Phase 1: Foundation（第 1-2 周）

| 任务 | 工期 | 交付物 |
|------|------|--------|
| 项目初始化 | 1 天 | Next.js 项目、FastAPI 服务 |
| PostgreSQL Schema 设计 | 1 天 | ER 图、DDL 脚本 |
| 基础 API 实现 | 3 天 | Sessions、Runs、Messages CRUD |
| 基础 Console Layout | 2 天 | 页面框架、三栏布局 |
| 前端基础组件 | 2 天 | Button、Input、Card 等基础组件 |
| 开发环境搭建 | 1 天 | Docker、数据库迁移脚本 |

**里程碑**：基础框架可运行，能创建会话并发送消息

### Phase 2: Realtime Runs（第 3-4 周）

| 任务 | 工期 | 交付物 |
|------|------|--------|
| Agent Worker 实现 | 3 天 | Python LangGraph Runtime |
| SSE Event Stream | 2 天 | Run events 推送 |
| 模型流式输出 | 2 天 | 前端流式展示 |
| Run Timeline 组件 | 2 天 | 时间线 UI |
| Conversation Panel | 2 天 | 对话面板 |

**里程碑**：能够启动 Run 并实时看到流式输出

### Phase 3: Tool Calls And Approval（第 5-6 周）

| 任务 | 工期 | 交付物 |
|------|------|--------|
| Tool Gateway 实现 | 3 天 | 工具注册、参数校验、风险分级 |
| Tool Call 持久化 | 1 天 | tool_calls 表 |
| Approval Request | 2 天 | 审批请求创建 |
| Approve/Reject API | 1 天 | 审批决策接口 |
| Approval Card UI | 2 天 | 审批卡片组件 |
| Edit & Approve | 1 天 | 编辑参数后执行 |
| Audit Log | 1 天 | 审计记录写入 |

**里程碑**：Tool Call 可被拦截并审批，决策可审计

### Phase 4: Files And Logs（第 7-8 周）

| 任务 | 工期 | 交付物 |
|------|------|--------|
| 结构化日志服务 | 2 天 | 日志写入和查询 API |
| Logs Panel UI | 2 天 | 日志面板组件 |
| File Diff 模型 | 1 天 | file_diffs 表 |
| Diff Viewer | 2 天 | Monaco Diff Editor |
| Patch Approval Flow | 1 天 | 文件修改审批流程 |
| Artifacts 存储 | 1 天 | 文件产物管理 |

**里程碑**：文件修改可预览和审批

### Phase 5: Production Readiness（第 9-10 周）

| 任务 | 工期 | 交付物 |
|------|------|--------|
| 用户认证 | 2 天 | JWT 认证 |
| 项目权限 | 1 天 | 项目级访问控制 |
| Reconnect Recovery | 2 天 | 断线重连状态恢复 |
| Token 统计 | 1 天 | 用量统计 |
| 成本估算 | 1 天 | 费用计算 |
| OpenTelemetry | 2 天 | 埋点兼容 |
| 部署文档 | 1 天 | Docker、K8s 部署 |

**里程碑**：可上线生产环境

### Phase 6: Desktop Packaging（后续）

| 任务 | 工期 | 交付物 |
|------|------|--------|
| Tauri Shell | 2 天 | 桌面壳 |
| Rust Permission Bridge | 3 天 | 本地权限控制 |
| Python Sidecar | 2 天 | 本地运行时 |
| SQLite 存储 | 1 天 | 本地持久化 |
| 自动更新 | 1 天 | Tauri 更新机制 |

---

## 十、总工期估算

| Phase | 周数 | 累计 |
|-------|------|------|
| Phase 1: Foundation | 2 周 | 2 周 |
| Phase 2: Realtime Runs | 2 周 | 4 周 |
| Phase 3: Tool Calls And Approval | 2 周 | 6 周 |
| Phase 4: Files And Logs | 2 周 | 8 周 |
| Phase 5: Production Readiness | 2 周 | 10 周 |
| **MVP 总计** | **10 周** | **10 周** |

> **说明**：按每天 8 小时、每周 5 天估算。Phase 6 桌面端属于 MVP 后规划。

---

## 十一、MVP 交付检查清单

### 功能验收

- [ ] 能创建会话并发送任务
- [ ] 能看到模型流式输出
- [ ] Run Timeline 正确展示各步骤
- [ ] Tool Call Inspector 显示工具详情
- [ ] 高风险操作触发审批卡片
- [ ] Approve/Reject/Edit 决策正确执行
- [ ] 日志面板展示结构化日志
- [ ] 文件 Diff 正确预览
- [ ] 刷新页面能恢复 active run
- [ ] 审计日志记录所有敏感操作

### 非功能验收

- [ ] SSE 延迟 < 500ms
- [ ] 页面加载 < 2s
- [ ] 支持 Chrome、Firefox、Safari 最新版本
- [ ] 敏感操作强制审计记录

---

## 十二、风险与依赖

| 风险 | 影响 | 应对 |
|------|------|------|
| LangGraph 学习成本 | 中 | 提前预研，参考官方示例 |
| SSE 断连重连 | 中 | 实现心跳检测和自动重连 |
| 复杂 Tool Call 参数 | 高 | 统一 schema 校验 |
| 模型厂商 API 变更 | 低 | 抽象模型接口层 |
| 前端流式渲染性能 | 中 | 虚拟列表优化 |

---

## 附录：文档索引

- 产品定位：`docs/product-agent-console.md`
- 技术设计：`docs/design-agent-console.md`
- 产品与技术方案：`docs/agent-console-cn.md`