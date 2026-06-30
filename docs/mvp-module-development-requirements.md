# Agent Console MVP 模块开发内容与要求

## 1. 文档目的

本文档沉淀当前 MVP 阶段需要优先补齐的五个模块：

- 会话列表
- Agent 对话流
- Run Timeline
- 文件 Diff
- 审计记录

目标是把每个模块的开发内容、接口契约、事件契约、验收标准和测试要求说清楚，作为后续开发和验收依据。

## 2. 当前判断

当前项目已经具备前后端骨架和主要 UI 组件，但尚未达到 MVP 可验收状态。主要原因是：

- 前端生产构建失败，`frontend/src/components/ConversationPanel.tsx` 存在 JSX 结构错误。
- SSE 事件 payload 前后端不一致，导致前端 store 不能稳定更新。
- Run Timeline、文件 Diff、审计记录虽然有部分模型或 UI，但端到端数据链路未闭合。
- 审批与审计在 REST 和 WebSocket 两条路径上的行为不一致。
- 部分工具、diff 和日志生成仍是占位逻辑。

本轮开发应先保证这五个模块形成稳定闭环，再扩展高级能力。

## 3. 全局开发要求

### 3.1 技术边界

前端继续沿用：

```text
Next.js + React + TypeScript + Tailwind + shadcn/ui + Zustand
```

后端继续沿用：

```text
FastAPI + SQLAlchemy + PostgreSQL + SSE + WebSocket
```

### 3.2 统一事件格式

所有 SSE 事件必须使用同一 envelope：

```json
{
  "event_id": "evt_123",
  "run_id": "run_123",
  "type": "message.delta",
  "created_at": "2026-05-07T10:00:00Z",
  "payload": {}
}
```

前端 `frontend/src/lib/realtime/runEvents.ts` 和后端 `backend/app/services/events.py` 必须以同一份事件契约为准。

### 3.3 验证基线

每次交付至少通过：

```bash
cd frontend
npm run build
```

```bash
cd backend
python -m compileall app
```

如已安装后端依赖，还应通过：

```bash
cd backend
python -c "import app.main; print('backend import ok')"
```

## 4. 模块一：会话列表

### 4.1 目标

用户进入 Console 后，可以看到项目下的会话列表，创建新会话，选择历史会话，删除会话，并在选择会话后加载对应消息和最近一次 run 状态。

### 4.2 当前相关文件

前端：

- `frontend/src/components/SessionSidebar.tsx`
- `frontend/src/lib/api/sessions.ts`
- `frontend/src/lib/api/projects.ts`
- `frontend/src/stores/consoleStore.ts`

后端：

- `backend/app/api/routes/sessions.py`
- `backend/app/api/routes/projects.py`
- `backend/app/models/models.py`
- `backend/app/schemas/session.py`

### 4.3 开发内容

1. 修正会话列表初始化逻辑。
   - 页面加载时获取项目列表。
   - 没有项目时创建默认项目。
   - 有项目时选中默认项目并加载 sessions。
   - API 失败时展示错误状态，而不是只写 `console.error`。

2. 完善会话选择行为。
   - 选择会话后更新 `selectedSessionId`。
   - 清空上一会话的临时 run 数据：`toolCalls`、`approvals`、`steps`、`fileDiffs`、`logs`、`streamContent`。
   - 加载该会话历史消息。
   - 如果存在 `last_run_id`，加载最近 run 的详情、steps、tool calls、diffs、logs。

3. 完善删除会话行为。
   - 删除前如果该会话有 active run，应禁止删除或弹出确认。
   - 删除成功后从 store 移除。
   - 如果删除的是当前会话，应清空选中状态和右侧详情区。

4. 增加加载、空状态和错误状态。
   - 加载中显示 spinner。
   - 空列表显示可创建会话的状态。
   - 错误时显示重试按钮。

### 4.4 API 要求

`GET /api/sessions?project_id={project_id}` 返回：

```json
{
  "sessions": [
    {
      "id": "session_123",
      "project_id": "project_123",
      "name": "Session name",
      "created_at": "2026-05-07T10:00:00Z",
      "updated_at": "2026-05-07T10:00:00Z",
      "last_run_id": "run_123"
    }
  ],
  "total": 1
}
```

`POST /api/sessions` 请求：

```json
{
  "project_id": "project_123",
  "name": "New session"
}
```

### 4.5 验收标准

- 用户首次进入 Console 时能自动看到默认项目的会话列表。
- 没有会话时可以创建新会话。
- 点击会话后，对话区加载该会话消息。
- 切换会话不会残留上一个 run 的 tool calls、logs、diffs。
- 删除会话后列表立即刷新。
- 前端构建通过。

## 5. 模块二：Agent 对话流

### 5.1 目标

用户能在选中会话后输入任务，创建 run，看到用户消息和 Agent 的流式输出。run 完成后，assistant 消息应持久化并在刷新后可恢复。

### 5.2 当前相关文件

前端：

- `frontend/src/components/ConversationPanel.tsx`
- `frontend/src/lib/api/runs.ts`
- `frontend/src/lib/realtime/runEvents.ts`
- `frontend/src/stores/consoleStore.ts`
- `frontend/src/types/index.ts`

后端：

- `backend/app/api/routes/runs.py`
- `backend/app/services/events.py`
- `backend/app/agent/runtime/langgraph_agent.py`
- `backend/app/models/models.py`

### 5.3 开发内容

1. 修复 `ConversationPanel.tsx` 构建错误。
   - 修正 `messages.map()` 的 JSX 括号结构。
   - 移除重复解构的 `setFileDiffs`。
   - 移除未使用的 `appendStreamContent` 或实际使用它。

2. 统一 `message.completed` 事件。
   - 前端当前期望 `payload.message`。
   - 后端必须发送完整 `Message` 对象，或者前端改为根据 `{message_id, content}` 组装对象。
   - 推荐后端发送完整对象，减少前端猜测。

3. 创建 run 后应保存用户消息。
   - 用户输入不只添加到前端 store，也应写入后端 `messages` 表。
   - run 创建失败时，本地临时用户消息应标记失败或回滚。

4. 流式输出期间明确状态。
   - run 创建后设置 `isStreaming=true`。
   - 收到 `run.completed`、`run.failed`、`run.cancelled` 后设置 `isStreaming=false`。
   - 取消 run 时调用 REST 或 WebSocket 后，以服务端事件为准更新最终状态。

5. 刷新恢复。
   - 选择会话后加载历史消息。
   - 如果 run 正在运行，重新连接 `/api/runs/{run_id}/events`。
   - 通过 `after_event_id` 支持从最后事件继续读取。

### 5.4 事件要求

`message.delta`：

```json
{
  "content": "partial token text"
}
```

`message.completed`：

```json
{
  "message": {
    "id": "msg_123",
    "session_id": "session_123",
    "role": "assistant",
    "content": "Full assistant response",
    "created_at": "2026-05-07T10:00:00Z"
  }
}
```

`run.started`：

```json
{
  "run_id": "run_123",
  "status": "running"
}
```

`run.completed`：

```json
{
  "run_id": "run_123",
  "status": "completed",
  "total_tokens": 1024,
  "estimated_cost": 0.03
}
```

`run.failed`：

```json
{
  "run_id": "run_123",
  "status": "failed",
  "error": "Readable error message"
}
```

### 5.5 验收标准

- `npm run build` 通过。
- 创建会话后可以发送第一条消息。
- 用户消息立即展示，并最终可从后端重新加载。
- Agent 输出以 SSE 流式展示。
- run 完成后 assistant 消息进入消息列表，刷新后仍存在。
- run 失败时展示错误状态，输入框恢复可用。
- 取消 run 后状态为 cancelled，流式输出停止。

## 6. 模块三：Run Timeline

### 6.1 目标

Timeline 用于展示一个 run 的执行过程，让用户看清 Agent 做了哪些步骤、每一步的状态、耗时和错误。

### 6.2 当前相关文件

前端：

- `frontend/src/components/TimelinePanel.tsx`
- `frontend/src/lib/realtime/runEvents.ts`
- `frontend/src/lib/api/runs.ts`
- `frontend/src/stores/consoleStore.ts`
- `frontend/src/types/index.ts`

后端：

- `backend/app/api/routes/runs.py`
- `backend/app/services/events.py`
- `backend/app/models/models.py`
- `backend/app/schemas/run_detail.py`
- `backend/app/agent/runtime/langgraph_agent.py`

### 6.3 开发内容

1. 完善 agent step 生成。
   - run 开始时生成 `run.started` 事件。
   - 每次模型调用创建 `AgentStep(step_type="message")`。
   - 每次工具调用创建或关联 `AgentStep(step_type="tool_call")`。
   - 审批暂停创建 `AgentStep(step_type="approval")`。
   - 错误创建 `AgentStep(step_type="error")` 或更新当前 step 为 failed。

2. 统一 step 事件。
   - `step.started` 必须发送完整 `AgentStep`。
   - `step.completed` 必须发送完整 `AgentStep`。
   - 如果失败，发送 `step.failed` 或用 `step.completed` 携带 `status="failed"`；推荐新增 `step.failed`。

3. Timeline UI 展示要求。
   - 按 `step_order` 升序展示。
   - 不同 step type 使用不同图标或颜色。
   - 当前 running step 高亮。
   - failed step 展示错误摘要。
   - 点击 step 可联动 Inspector 中对应 tool call 或 approval。

4. 历史恢复。
   - 打开已有 run 时调用 `GET /api/runs/{run_id}/steps`。
   - SSE 只负责增量更新。

### 6.4 API 要求

`GET /api/runs/{run_id}/steps` 返回：

```json
{
  "steps": [
    {
      "id": "step_123",
      "run_id": "run_123",
      "step_order": 1,
      "step_type": "message",
      "status": "completed",
      "created_at": "2026-05-07T10:00:00Z",
      "completed_at": "2026-05-07T10:00:02Z"
    }
  ]
}
```

### 6.5 事件要求

`step.started`：

```json
{
  "step": {
    "id": "step_123",
    "run_id": "run_123",
    "step_order": 1,
    "step_type": "message",
    "status": "started",
    "created_at": "2026-05-07T10:00:00Z"
  }
}
```

`step.completed`：

```json
{
  "step": {
    "id": "step_123",
    "run_id": "run_123",
    "step_order": 1,
    "step_type": "message",
    "status": "completed",
    "created_at": "2026-05-07T10:00:00Z",
    "completed_at": "2026-05-07T10:00:02Z"
  }
}
```

### 6.6 验收标准

- 创建 run 后 Timeline 至少展示 run start、model message、run completed。
- 触发 tool call 时 Timeline 展示 tool step。
- 触发审批时 Timeline 展示 approval step。
- 出错时 Timeline 能展示 failed 状态和错误摘要。
- 刷新页面后 Timeline 能从后端恢复。

## 7. 模块四：文件 Diff

### 7.1 目标

当 Agent 产生文件修改时，用户可以看到文件列表和 diff 内容，并能理解是创建、修改还是删除文件。

### 7.2 当前相关文件

前端：

- `frontend/src/components/FileDiffView.tsx`
- `frontend/src/components/InspectorPanel.tsx`
- `frontend/src/lib/api/runs.ts`
- `frontend/src/lib/realtime/runEvents.ts`
- `frontend/src/stores/consoleStore.ts`
- `frontend/src/types/index.ts`

后端：

- `backend/app/models/models.py`
- `backend/app/api/routes/runs.py`
- `backend/app/schemas/run_detail.py`
- `backend/app/agent/tools/registry.py`
- `backend/app/agent/tools/gateway.py`

### 7.3 开发内容

1. 明确 diff 产生位置。
   - 写文件、删除文件、批量 patch 等工具必须通过 Tool Gateway。
   - Tool Gateway 在执行前生成 preview diff。
   - 执行成功后保存最终 `FileDiff`。

2. 完善 `FileDiff` 数据写入。
   - `write_file` 应生成 `created` 或 `modified` diff。
   - `delete_file` 应生成 `deleted` diff。
   - diff 内容使用 unified diff 格式。

3. 完善前端展示。
   - Inspector 的 Files tab 展示文件路径和 change type。
   - 点击文件后展示 `FileDiffView`。
   - `created`、`modified`、`deleted` 使用清晰状态标识。
   - diff 内容过长时可滚动，不撑破右侧面板。

4. 历史恢复。
   - 打开已有 run 时调用 `GET /api/runs/{run_id}/diffs`。
   - 收到 `file_diff.created` 后追加到 store。

5. 与审批联动。
   - 高风险文件写入应先产生 preview。
   - Approval 卡片应能展示将要修改的文件路径和 diff 摘要。
   - 用户 approve 后才真正写入。

### 7.4 API 要求

`GET /api/runs/{run_id}/diffs` 返回：

```json
{
  "diffs": [
    {
      "id": "diff_123",
      "run_id": "run_123",
      "file_path": "src/example.ts",
      "change_type": "modified",
      "diff_content": "--- a/src/example.ts\n+++ b/src/example.ts\n@@ -1 +1 @@\n-old\n+new\n",
      "created_at": "2026-05-07T10:00:00Z"
    }
  ]
}
```

### 7.5 事件要求

`file_diff.created`：

```json
{
  "file_diff": {
    "id": "diff_123",
    "run_id": "run_123",
    "file_path": "src/example.ts",
    "change_type": "modified",
    "diff_content": "--- a/src/example.ts\n+++ b/src/example.ts\n@@ -1 +1 @@\n-old\n+new\n",
    "created_at": "2026-05-07T10:00:00Z"
  }
}
```

### 7.6 验收标准

- Agent 修改文件时，Files tab 出现对应文件。
- 点击文件能看到 diff 内容。
- 创建、修改、删除三种 change type 都能正确展示。
- 刷新后仍能看到历史 diff。
- 高风险写文件操作在审批前不会直接落盘。

## 8. 模块五：审计记录

### 8.1 目标

所有敏感操作必须形成可查询的审计记录，尤其是审批决策和高风险工具调用。

### 8.2 当前相关文件

前端：

- `frontend/src/lib/api/audit.ts`
- 后续可新增 `frontend/src/components/AuditLogPanel.tsx`
- 后续可新增 `frontend/src/app/audit/page.tsx`

后端：

- `backend/app/api/routes/audit.py`
- `backend/app/services/audit.py`
- `backend/app/api/routes/tool_calls.py`
- `backend/app/services/websocket.py`
- `backend/app/models/models.py`

### 8.3 开发内容

1. 统一审计入口。
   - REST 审批路径和 WebSocket 审批路径都必须调用同一个 audit service。
   - 禁止只更新 approval 状态而不写 audit log。

2. 审计事件范围。
   - run.created
   - run.cancelled
   - approval.approved
   - approval.rejected
   - approval.edited
   - tool_call.executed
   - tool_call.failed
   - file.created
   - file.modified
   - file.deleted

3. 审计 metadata 要求。
   - 对审批事件，记录 approval_id、tool_call_id、decision、reason、edited_args。
   - 对工具事件，记录 tool_name、risk_level、required_permission。
   - 对文件事件，记录 file_path、change_type、diff_id。
   - 对 run 事件，记录 session_id、model、status。

4. 审计查询 API。
   - 支持按 `project_id` 查询。
   - 支持按 `action` 查询。
   - 支持按 `actor_id` 查询。
   - 支持分页。
   - 支持时间范围。

5. 前端展示。
   - MVP 可先提供 API，不强制做完整审计页面。
   - 如果做 UI，优先实现项目级 Audit Log 列表。

### 8.4 API 要求

`GET /api/audit?project_id={project_id}&action={action}&limit=50&offset=0` 返回：

```json
{
  "logs": [
    {
      "id": "audit_123",
      "project_id": "project_123",
      "actor_id": "user_123",
      "action": "approval.approved",
      "target_type": "approval_request",
      "target_id": "approval_123",
      "metadata": {
        "tool_call_id": "tool_123",
        "decision": "approved",
        "reason": "Looks safe"
      },
      "created_at": "2026-05-07T10:00:00Z"
    }
  ],
  "total": 1
}
```

### 8.5 验收标准

- Approve、Reject、Edit 三种审批决策都会写入 audit log。
- REST 和 WebSocket 两种审批入口的审计行为一致。
- 高风险 tool call 执行成功或失败都会写入 audit log。
- 文件创建、修改、删除都会写入 audit log。
- 可以通过 API 查询项目下审计记录。

## 9. 端到端验收场景

### 9.1 会话与对话

1. 打开 Console。
2. 创建新会话。
3. 输入任务并发送。
4. 看到用户消息。
5. 看到 Agent 流式输出。
6. run 完成后刷新页面。
7. 历史消息仍然存在。

### 9.2 Timeline

1. 创建 run。
2. Timeline 出现 message step。
3. 触发工具调用。
4. Timeline 出现 tool_call step。
5. run 完成后 Timeline 展示 completed 状态。

### 9.3 文件 Diff

1. 触发写文件工具。
2. 生成 pending approval。
3. Approval 中能看到文件路径或 diff 摘要。
4. Approve 后执行写入。
5. Files tab 展示 diff。
6. 刷新后 diff 仍可查询。

### 9.4 审计记录

1. 触发高风险 tool call。
2. 执行 approve。
3. 查询 audit API。
4. 看到 `approval.approved` 记录。
5. metadata 中包含 approval_id、tool_call_id、decision 和 reason。

## 10. 优先级建议

### P0：必须先修

1. 修复 `ConversationPanel.tsx` 构建失败。
2. 统一 SSE payload contract。
3. 让 Agent 对话流端到端跑通。
4. 让 Run Timeline 能展示最小 step 链路。

### P1：MVP 必须完成

1. 会话切换时恢复历史消息和最近 run。
2. 文件 Diff 从工具执行链路中真实产生。
3. 审批决策写入统一 audit service。
4. 刷新页面后恢复 Timeline 和 Diff。

### P2：MVP 后增强

1. 单独 Audit Log 页面。
2. Timeline 和 Inspector 的双向联动。
3. Diff 使用 Monaco Diff Editor。
4. 审计日志导出。

## 11. 不通过标准

出现以下任一情况，不应判定为 MVP 完成：

- 前端 `npm run build` 失败。
- 创建 run 后没有真实 SSE 输出。
- `message.completed` 后刷新页面看不到 assistant 消息。
- tool call 事件只包含 id，前端无法展示完整详情。
- 文件 Diff 只存在 UI，没有后端记录。
- 审批成功但没有 audit log。
- REST 和 WebSocket 审批行为不一致。

