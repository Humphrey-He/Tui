# Agent Console 产品与技术方案

## 1. 定位

Agent Console 是一个面向 AI Agent 的控制台和工作台。它不是普通聊天框，也不是传统 CRUD 后台，而是一个用于观察、控制、审批、恢复和审计 Agent 执行过程的实时操作台。

它需要支持：

- 模型流式输出
- 工具调用展示
- 多步骤任务进度
- 人工审批
- 执行日志
- 文件和代码 diff
- 会话历史
- 权限控制
- 审计记录

推荐路线：

```text
先做 Web Agent Console。
再复用前端和 Agent Core 封装 Tauri 桌面端。
```

## 2. 推荐技术栈

### Web 版

```text
Frontend:
  Next.js + React + TypeScript + Tailwind + shadcn/ui

Backend:
  FastAPI

Agent Runtime:
  Python + LangGraph

Storage:
  PostgreSQL + Redis

Realtime:
  SSE + WebSocket

Observability:
  OpenTelemetry
```

### 桌面版

```text
Desktop:
  Tauri

UI:
  React + TypeScript + Tailwind

Native Layer:
  Rust

Agent Runtime:
  Python sidecar 或 Node sidecar

Local Storage:
  SQLite

Communication:
  localhost WebSocket / stdio / gRPC
```

## 3. 为什么先做 Web

第一阶段建议先做 Web 控制台，而不是直接做完整桌面应用。

原因：

1. Web 更适合快速验证产品闭环。
2. Next.js + React 能高效构建复杂交互界面。
3. Agent Runtime 可以独立成服务，后续复用于 Web、Desktop、IDE 插件和 TUI。
4. 桌面端涉及本地权限、文件系统、shell、安全边界和自动更新，适合在核心能力稳定后再做。
5. 先 Web 后 Desktop 可以避免过早绑定客户端形态。

## 4. MVP 范围

第一版应该聚焦 Agent 执行闭环。

必须包含：

| 模块 | 说明 |
| --- | --- |
| 会话列表 | 浏览和恢复历史会话、历史 run |
| Agent 对话流 | 展示用户输入、模型流式输出、运行状态 |
| Run Timeline | 展示 model call、tool call、approval、error、completion |
| Tool Call Inspector | 展示工具名称、参数、结果、错误、耗时、风险级别 |
| 人工审批 | 支持 approve、reject、edit tool call |
| 日志面板 | 展示结构化执行日志 |
| 文件 Diff | 预览 Agent 对文件或代码的修改 |
| 持久化 | 保存 messages、runs、tool calls、approvals、logs、artifacts |
| 审计记录 | 记录敏感操作和审批决策 |

暂不做：

- 企业级多租户计费
- 插件市场
- 复杂 DAG 工作流编辑器
- 完整 IDE
- 高级多 Agent 可视化编排
- 完整 RBAC 权限矩阵
- 自研完整 observability 平台

## 5. 核心用户流程

### 5.1 启动任务

1. 用户选择项目或会话。
2. 用户输入任务。
3. 后端创建 run。
4. Agent Runtime 开始执行。
5. 前端通过 SSE 接收 token 和 step events。
6. Conversation、Timeline、Inspector 同步更新。

### 5.2 审批工具调用

1. Agent 生成 tool call。
2. Tool Gateway 校验参数、识别风险、检查权限策略。
3. 如果需要审批，run 暂停。
4. UI 展示工具名称、参数、风险、预览结果。
5. 用户选择 approve、edit 或 reject。
6. 后端记录审计日志。
7. Agent Runtime 根据用户决策继续执行。

### 5.3 查看文件修改

1. Agent 生成文件修改。
2. 后端保存 file diff。
3. UI 在 Inspector 中展示文件列表。
4. 用户打开 diff viewer 查看修改。
5. 用户批准、拒绝或要求 Agent 修改。

### 5.4 恢复长任务

1. 用户刷新页面或断线重连。
2. 前端重新读取 session、run、messages、events。
3. 后端返回当前 run 状态和历史事件。
4. UI 恢复 Conversation、Timeline、Tool Calls、Logs 和 Pending Approvals。

## 6. 信息架构

推荐布局：

```text
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

主要页面：

| 页面 | 作用 |
| --- | --- |
| Console | Agent 对话、运行控制、实时状态 |
| Runs | 查看历史 run 和当前 active run |
| Approval Inbox | 集中处理待审批工具调用 |
| Files | 文件树、产物、diff |
| Trace | latency、tokens、cost、span、error |
| Settings | 模型、工具权限、环境变量、system prompt |
| Audit Log | 敏感操作和审批记录 |

## 7. 实时通信设计

### SSE

SSE 用于服务端到客户端的持续推送。

适合：

- LLM token streaming
- Agent step events
- Tool call 状态变化
- 日志事件
- Run 状态变化

接口示例：

```text
GET /api/runs/{run_id}/events
```

事件示例：

```json
{
  "event_id": "evt_123",
  "run_id": "run_123",
  "type": "tool_call.pending_approval",
  "created_at": "2026-05-07T10:00:00Z",
  "payload": {}
}
```

### WebSocket

WebSocket 用于双向控制。

适合：

- cancel run
- approve tool call
- reject tool call
- edit tool call arguments
- 后续 interactive terminal

建议不要把所有数据都塞进 WebSocket。查询用 REST，流式输出用 SSE，实时控制用 WebSocket。

## 8. 后端架构

```text
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
```

### API Service 职责

- 用户认证和授权
- 项目、会话、run 管理
- 启动、取消、恢复 run
- 提供 SSE event stream
- 接收审批决策
- 查询日志、tool calls、diff、artifacts

### Agent Runtime 职责

- 调用模型
- 规划工具调用
- 处理 tool call 生命周期
- 遇到 HITL 时暂停
- 接收审批结果并恢复执行
- 发送结构化事件

### Tool Gateway 职责

- 校验 tool arguments
- 判断风险等级
- 检查权限
- 生成预览
- 执行工具
- 写入审计日志
- 阻止 Agent 绕过权限直接执行敏感操作

## 9. 数据模型

核心表：

```text
users
projects
sessions
runs
messages
agent_steps
tool_calls
approval_requests
run_events
files
file_diffs
artifacts
audit_logs
```

### runs

```text
id
project_id
session_id
status
started_by
started_at
completed_at
cancelled_at
error_message
model
total_tokens
estimated_cost
```

### tool_calls

```text
id
run_id
step_id
tool_name
arguments_json
result_json
status
risk_level
required_permission
started_at
completed_at
error_message
```

### approval_requests

```text
id
run_id
tool_call_id
status
requested_action
original_args_json
edited_args_json
decision
decision_reason
decided_by
decided_at
created_at
```

### audit_logs

```text
id
project_id
actor_id
action
target_type
target_id
metadata_json
created_at
```

## 10. Human-in-the-loop 设计

每个 tool 都应该声明自己的执行策略：

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

审批决策：

```text
approve: 按原参数执行
edit: 修改参数后执行
reject: 拒绝执行，并把反馈返回给 Agent
```

默认需要审批的操作：

- 修改或删除文件
- 执行 shell 命令
- 访问密钥或环境变量
- 查询生产数据库
- 写入外部系统
- 删除数据
- 发起网络请求到敏感服务

## 11. 桌面端设计

桌面端建议在 Web MVP 稳定后再做。

结构：

```text
Tauri Shell:
  Rust

UI:
  复用 React + TypeScript 前端

Local Runtime:
  Python sidecar 或 Node sidecar

Storage:
  SQLite

Communication:
  localhost WebSocket / stdio / gRPC
```

Rust 层负责：

- 限制可访问目录
- 限制 shell 命令
- 管理本地凭据
- 启动和停止 sidecar
- 写入本地审计日志
- 提供系统能力边界

Agent Runtime 不建议直接写在 Rust 里。Rust 更适合做安全边界和系统桥接，Agent 逻辑仍然建议放在 Python 或 TypeScript。

## 12. 可观测性

从第一版开始就应该让事件模型兼容 OpenTelemetry。

需要记录：

- run trace id
- model call span
- tool call span
- step latency
- token usage
- estimated cost
- error type
- approval wait time
- user decision

早期可以先写入 PostgreSQL 和应用日志。后续再接 OpenTelemetry Collector、Prometheus、Grafana、LangSmith 或自研 trace viewer。

## 13. 安全原则

基础要求：

- 所有项目和 run 都需要鉴权访问。
- 敏感 tool call 必须服务端强制审批。
- 前端不能直接访问 secret。
- tool arguments 必须按 schema 校验。
- 文件访问必须受 workspace policy 限制。
- shell 默认禁用，启用时必须有审批和审计。
- 所有 approve、edit、reject 都必须写入 audit log。
- 桌面端必须由 Rust 层 enforce 本地权限，而不是信任 UI。

## 14. 测试策略

### 前端

- ApprovalCard 组件测试
- Timeline 组件测试
- ToolCallInspector 组件测试
- DiffViewer 组件测试
- SSE event handling 集成测试
- reconnect UI 恢复测试

### 后端

- tool policy 单元测试
- approval rules 单元测试
- run creation API 测试
- approval decision API 测试
- cancel run API 测试
- worker event emission 测试

### 端到端

- 创建 run 并流式输出
- 执行低风险 tool call
- 触发高风险 tool call 并 approve
- reject tool call 并让 Agent 收到反馈
- 页面刷新后恢复 active run
- 生成文件 diff 并展示

## 15. 实施阶段

### Phase 1: Foundation

- 初始化 Next.js app
- 初始化 FastAPI service
- 建立 PostgreSQL schema
- 实现 sessions、messages、runs
- 搭建基础 Console layout

### Phase 2: Realtime Runs

- 实现 Agent worker
- 实现 SSE run events
- 实现模型流式输出
- 实现 Run Timeline

### Phase 3: Tool Calls And Approval

- 实现 Tool Gateway
- 持久化 tool_calls
- 实现 approval_requests
- 实现 approve / edit / reject
- 写入 audit_logs

### Phase 4: Files And Logs

- 实现结构化日志
- 实现 artifacts 和 file_diffs
- 实现 diff viewer
- 实现 patch approval flow

### Phase 5: Production Readiness

- 增加 authentication
- 增加 project permissions
- 增强 reconnect recovery
- 接入 OpenTelemetry export path
- 容器化 API 和 worker

### Phase 6: Desktop Packaging

- 增加 Tauri shell
- 增加 Rust local capability bridge
- 增加 local sidecar lifecycle
- 增加 SQLite local mode
- 实现桌面打包和自动更新

## 16. 最终建议

最稳妥的落地方案是：

```text
先做 Web Agent Console MVP：
  Next.js + React + TypeScript + Tailwind + shadcn/ui
  FastAPI + Python LangGraph
  PostgreSQL + Redis
  SSE + WebSocket
  OpenTelemetry-ready event model

再做桌面版：
  Tauri + React + TypeScript
  Rust 负责本地权限和系统能力
  Python / Node sidecar 负责 Agent Runtime
  SQLite 负责本地会话和审计
```

核心原则是：UI、API、Agent Runtime、Tool Gateway 分层清楚。先把 Agent 执行过程变得可见、可控、可恢复、可审计，再扩展到桌面、本地文件系统、IDE 插件和企业平台能力。

