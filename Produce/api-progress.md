# Agent Console - 前后端进度同步

## 更新日期: 2026-05-07

---

## 一、前端开发进度

### 已完成 ✅
| 功能 | 路径 | 状态 |
|------|------|------|
| 项目基础结构 | `frontend/` | ✅ Next.js + React + TypeScript + Tailwind |
| UI 组件库 | `frontend/src/components/ui/` | ✅ Button, Input, Card, ScrollArea, Tabs, Dialog |
| 会话列表加载 | `SessionSidebar.tsx` | ✅ 组件挂载时自动加载 |
| 会话创建 | `SessionSidebar.tsx` | ✅ |
| 会话删除 | `SessionSidebar.tsx` | ✅ |
| 消息加载 | `ConversationPanel.tsx` | ✅ 选中会话时加载历史消息 |
| 会话选择状态 | `consoleStore.ts` | ✅ |
| API 客户端 | `frontend/src/lib/api/` | ✅ client, sessions, runs, approvals |
| 实时服务 | `frontend/src/lib/realtime/` | ✅ runEvents (SSE), controlSocket (WebSocket) |
| **SSE 事件处理** | `runEvents.ts` | ✅ **已完成所有事件处理** |

### 开发中 🔄
| 功能 | 路径 | 状态 | 说明 |
|------|------|------|------|
| WebSocket 控制 | `controlSocket.ts` | 🔄 | 需与 UI 审批卡片交互 |
| 流式输出展示 | `ConversationPanel.tsx` | 🔄 | SSE 驱动，已集成 |
| Tool Call 列表 | `InspectorPanel.tsx` | 🔄 | SSE 事件更新，已集成 |
| Timeline 步骤 | `TimelinePanel.tsx` | 🔄 | SSE 事件更新，已集成 |

### 待开发 📋
| 功能 | 优先级 |
|------|--------|
| 审批卡片 (Approve/Reject/Edit) | P0 |
| 文件 Diff 展示 | P1 |
| 日志面板 | P1 |
| 断线重连 | P1 |
| 成本/Token 统计 | P2 |

---

## 二、后端 API 需求

### 2.1 已实现 ✅

#### Sessions API
| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/api/sessions` | ✅ | 获取会话列表 |
| GET | `/api/sessions/{session_id}` | ✅ | 获取单个会话 |
| POST | `/api/sessions` | ✅ | 创建会话 |
| PATCH | `/api/sessions/{session_id}` | ✅ | 更新会话 |
| DELETE | `/api/sessions/{session_id}` | ✅ | 删除会话 |
| GET | `/api/sessions/{session_id}/messages` | ✅ | 获取会话消息 |
| POST | `/api/sessions/{session_id}/messages` | ✅ | 添加消息 |

#### Runs API
| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/api/runs` | ✅ | 获取 Run 列表 |
| GET | `/api/runs/{run_id}` | ✅ | 获取单个 Run |
| POST | `/api/runs` | ✅ | 创建 Run |
| PATCH | `/api/runs/{run_id}` | ✅ | 更新 Run |
| POST | `/api/runs/{run_id}/cancel` | ✅ | 取消 Run |

### 2.2 后端待实现 📋

#### SSE Events (P0 - 高优先级) - **前端已实现处理逻辑，等待后端实现**

```
GET /api/runs/{run_id}/events
```
SSE 流式推送，事件类型：

| 事件类型 | 前端处理 | payload | 说明 |
|----------|----------|---------|------|
| `run.started` | ✅ | `{run_id, status}` | Run 启动 |
| `run.completed` | ✅ | `{run_id, total_tokens?, estimated_cost?}` | Run 完成 |
| `run.failed` | ✅ | `{run_id, error?}` | Run 失败 |
| `run.cancelled` | ✅ | `{run_id}` | Run 取消 |
| `message.created` | ✅ | `{message: Message}` | 消息创建 |
| `message.delta` | ✅ | `{content: string}` | 流式内容片段 |
| `message.completed` | ✅ | `{message: Message}` | 消息完成 |
| `step.started` | ✅ | `{step: AgentStep}` | 步骤开始 |
| `step.completed` | ✅ | `{step: AgentStep}` | 步骤完成 |
| `tool_call.created` | ✅ | `{tool_call: ToolCall}` | 工具调用创建 |
| `tool_call.pending_approval` | ✅ | `{tool_call: ToolCall, approval: ApprovalRequest}` | 等待审批 |
| `tool_call.started` | ✅ | `{tool_call: ToolCall}` | 工具调用开始 |
| `tool_call.completed` | ✅ | `{tool_call: ToolCall}` | 工具调用完成 |
| `tool_call.failed` | ✅ | `{tool_call: ToolCall}` | 工具调用失败 |
| `approval.created` | ✅ | `{approval: ApprovalRequest}` | 审批请求创建 |
| `approval.resolved` | ✅ | `{approval: ApprovalRequest}` | 审批完成 |
| `file_diff.created` | ✅ | `{file_diff: FileDiff}` | 文件差异创建 |

**Response**: `text/event-stream`

**Event Format**:
```json
data: {"event_id":"xxx","run_id":"xxx","type":"message.delta","created_at":"2026-05-07T10:00:00Z","payload":{"content":"Hello"}}

data: {"event_id":"xxx","run_id":"xxx","type":"tool_call.created","created_at":"2026-05-07T10:00:01Z","payload":{"id":"tc_xxx","tool_name":"read_file","arguments":{...}}}
```

**重要**: 前端根据 `payload` 中的完整对象更新 Store，请确保发送完整的对象数据。

---

#### WebSocket Control (P0 - 高优先级)
```
WS /api/ws/control
```
双向控制通道：

**Client -> Server**:

| 消息类型 | payload | 说明 |
|----------|---------|------|
| `cancel_run` | `{run_id}` | 取消 Run |
| `approve_tool_call` | `{approval_id, reason?}` | 批准工具调用 |
| `reject_tool_call` | `{approval_id, reason?}` | 拒绝工具调用 |
| `edit_tool_call` | `{approval_id, edited_args, reason?}` | 修改参数后执行 |

**Server -> Client**:

| 消息类型 | payload | 说明 |
|----------|---------|------|
| `connected` | `{}` | 连接成功 |
| `disconnected` | `{}` | 连接断开 |
| `run.status_changed` | `{run_id, status}` | Run 状态变化 |
| `approval.required` | `{approval}` | 需要审批 |

---

#### Approvals API (P0 - 高优先级)
| 方法 | 路径 | 状态 | 入参 | 返回 |
|------|------|------|------|------|
| GET | `/api/approvals` | 📋 | `?run_id=&status=pending` | `{approvals: [], total}` |
| GET | `/api/approvals/{approval_id}` | 📋 | - | `Approval` |
| POST | `/api/approvals/{approval_id}/resolve` | 📋 | `{decision, edited_args?, reason?}` | `Approval` |

**Approval Schema**:
```typescript
interface ApprovalRequest {
  id: string;
  run_id: string;
  tool_call_id: string;
  status: "pending" | "resolved";
  requested_action: string;
  original_args: Record<string, unknown>;
  edited_args?: Record<string, unknown>;
  decision?: "approved" | "rejected" | "edited";
  decision_reason?: string;
  decided_by?: string;
  decided_at?: string;
  created_at: string;
}
```

---

#### Tool Calls API (P0 - 高优先级)
| 方法 | 路径 | 状态 | 入参 | 返回 |
|------|------|------|------|------|
| GET | `/api/runs/{run_id}/tool_calls` | 📋 | - | `{tool_calls: []}` |
| GET | `/api/tool_calls/{tool_call_id}` | 📋 | - | `ToolCall` |

**ToolCall Schema**:
```typescript
interface ToolCall {
  id: string;
  run_id: string;
  step_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: "created" | "pending_approval" | "running" | "completed" | "failed" | "rejected";
  risk_level: "low" | "medium" | "high" | "critical";
  required_permission?: string;
  started_at: string;
  completed_at?: string;
  error_message?: string;
}
```

---

#### Steps API (P1)
| 方法 | 路径 | 状态 | 入参 | 返回 |
|------|------|------|------|------|
| GET | `/api/runs/{run_id}/steps` | 📋 | - | `{steps: []}` |

**AgentStep Schema**:
```typescript
interface AgentStep {
  id: string;
  run_id: string;
  step_order: number;
  step_type: "message" | "tool_call" | "approval" | "error";
  status: "started" | "completed" | "failed";
  created_at: string;
  completed_at?: string;
}
```

---

#### File Diffs API (P1)
| 方法 | 路径 | 状态 | 入参 | 返回 |
|------|------|------|------|------|
| GET | `/api/runs/{run_id}/file_diffs` | 📋 | - | `{file_diffs: []}` |

**FileDiff Schema**:
```typescript
interface FileDiff {
  id: string;
  run_id: string;
  file_path: string;
  change_type: "created" | "modified" | "deleted";
  diff_content: string;
  created_at: string;
}
```

---

#### Audit Logs API (P1)
| 方法 | 路径 | 状态 | 入参 | 返回 |
|------|------|------|------|------|
| GET | `/api/audit_logs` | 📋 | `?project_id=&actor_id=&action=&start_date=&end_date=` | `{logs: [], total}` |

---

## 三、后端实现优先级

### P0 - 必须实现 (阻塞前端)
1. **SSE Events Endpoint** - `GET /api/runs/{run_id}/events`
   - 这是前端流式输出和实时更新的核心
   - 需要实现完整的事件推送机制
   - 建议使用 Server-Sent Events (SSE)

2. **WebSocket Control Endpoint** - `WS /api/ws/control`
   - 用于审批操作和 Run 控制
   - 双向通信通道

3. **Approvals API** - 审批相关接口
   - 前端需要展示待审批列表

### P1 - 重要
1. Tool Calls API
2. Steps API
3. File Diffs API

### P2 - 增强
1. Audit Logs API

---

## 四、数据模型 (Reference)

### Sessions
```sql
sessions (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  last_run_id UUID
)
```

### Messages
```sql
messages (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  run_id UUID REFERENCES runs(id),
  role VARCHAR(20), -- user, assistant, system, tool
  content TEXT,
  created_at TIMESTAMP
)
```

### Runs
```sql
runs (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  session_id UUID REFERENCES sessions(id),
  status VARCHAR(20), -- pending, running, completed, failed, cancelled
  started_by VARCHAR(255),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  error_message TEXT,
  model VARCHAR(50),
  total_tokens INT DEFAULT 0,
  estimated_cost DECIMAL(10, 6) DEFAULT 0
)
```

### Tool Calls
```sql
tool_calls (
  id UUID PRIMARY KEY,
  run_id UUID REFERENCES runs(id),
  step_id UUID,
  tool_name VARCHAR(100),
  arguments JSONB,
  result JSONB,
  status VARCHAR(30),
  risk_level VARCHAR(20),
  required_permission VARCHAR(50),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT
)
```

### Approval Requests
```sql
approval_requests (
  id UUID PRIMARY KEY,
  run_id UUID REFERENCES runs(id),
  tool_call_id UUID REFERENCES tool_calls(id),
  status VARCHAR(20), -- pending, resolved
  requested_action TEXT,
  original_args JSONB,
  edited_args JSONB,
  decision VARCHAR(20), -- approved, rejected, edited
  decision_reason TEXT,
  decided_by VARCHAR(255),
  decided_at TIMESTAMP,
  created_at TIMESTAMP
)
```

---

## 五、前端 Store 状态管理

```typescript
interface ConsoleState {
  // Current selections
  selectedProjectId: string | null;
  selectedSessionId: string | null;
  selectedRunId: string | null;
  selectedToolCallId: string | null;
  selectedApprovalId: string | null;

  // Data
  sessions: Session[];
  currentRun: Run | null;
  messages: Message[];
  toolCalls: ToolCall[];
  approvals: ApprovalRequest[];
  steps: AgentStep[];
  fileDiffs: FileDiff[];

  // UI State
  isStreaming: boolean;
  streamContent: string;
  isConnected: boolean;
}
```

---

## 六、SSE 事件前端处理逻辑 (已实现)

前端 `runEvents.ts` 中已实现以下事件处理：

```typescript
// message.delta - 流式输出片段
on("message.delta", (event) => {
  const { content } = event.payload;
  useConsoleStore.getState().appendStreamContent(content);
});

// message.completed - 消息完成
on("message.completed", (event) => {
  const { message } = event.payload;
  useConsoleStore.getState().addMessage(message);
  useConsoleStore.getState().clearStreamContent();
});

// tool_call.created - 工具调用创建
on("tool_call.created", (event) => {
  const { tool_call } = event.payload;
  useConsoleStore.getState().addToolCall(tool_call);
});

// tool_call.pending_approval - 等待审批
on("tool_call.pending_approval", (event) => {
  const { tool_call, approval } = event.payload;
  useConsoleStore.getState().updateToolCall(tool_call.id, { status: "pending_approval" });
  useConsoleStore.getState().addApproval(approval);
});

// run.completed - Run 完成
on("run.completed", (event) => {
  const { total_tokens, estimated_cost } = event.payload;
  // ... update currentRun with new stats
  useConsoleStore.getState().setIsStreaming(false);
});
```

---

## 七、注意事项

1. **SSE 重连**: 前端已实现指数退避重连机制 (`maxReconnectAttempts = 5`)
2. **连接状态**: 前端通过 `setIsConnected` 追踪 SSE 连接状态
3. **Run 数据清理**: 创建新 Run 时，前端会清空 toolCalls、approvals、steps、fileDiffs
4. **消息加载**: 选中会话时会加载历史消息，创建新 Run 时保留历史消息
