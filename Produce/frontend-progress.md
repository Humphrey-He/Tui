# Agent Console - 前端开发进度

## 更新日期: 2026-05-07

---

## 组件清单

### 已完成 ✅

| 组件 | 路径 | 功能 |
|------|------|------|
| HomePage | `frontend/src/app/page.tsx` | 落地页 |
| ConsolePage | `frontend/src/app/console/page.tsx` | 主控制台页面 (三栏布局) |
| SessionSidebar | `frontend/src/components/SessionSidebar.tsx` | 会话列表侧边栏 |
| ConversationPanel | `frontend/src/components/ConversationPanel.tsx` | 对话面板 |
| InspectorPanel | `frontend/src/components/InspectorPanel.tsx` | 工具调用/审批/文件检查器 |
| TimelinePanel | `frontend/src/components/TimelinePanel.tsx` | 时间线面板 |
| ToolCallView | `frontend/src/components/ToolCallView.tsx` | 工具调用详情 |
| FileDiffView | `frontend/src/components/FileDiffView.tsx` | 文件差异展示 |
| **LogsPanel** | `frontend/src/components/LogsPanel.tsx` | **日志面板** ✅ |

### UI 组件 (shadcn/ui) ✅

| 组件 | 路径 |
|------|------|
| Button | `frontend/src/components/ui/button.tsx` |
| Input | `frontend/src/components/ui/input.tsx` |
| Card | `frontend/src/components/ui/card.tsx` |
| ScrollArea | `frontend/src/components/ui/scroll-area.tsx` |
| Tabs | `frontend/src/components/ui/tabs.tsx` |
| Dialog | `frontend/src/components/ui/dialog.tsx` |
| Badge | `frontend/src/components/ui/badge.tsx` |

---

## API 集成

### 已完成 ✅

| API | 路径 | 方法 |
|-----|------|------|
| 会话列表 | `sessionsApi.list()` | GET `/api/sessions` |
| 会话详情 | `sessionsApi.get(id)` | GET `/api/sessions/{id}` |
| 创建会话 | `sessionsApi.create()` | POST `/api/sessions` |
| 删除会话 | `sessionsApi.delete(id)` | DELETE `/api/sessions/{id}` |
| 会话消息 | `sessionsApi.messages(id)` | GET `/api/sessions/{id}/messages` |
| 创建 Run | `runsApi.create()` | POST `/api/runs` |
| 取消 Run | `runsApi.cancel(id)` | POST `/api/runs/{run_id}/cancel` |
| Run 事件流 | `runsApi.events(id)` | GET `/api/runs/{run_id}/events` |

### 待开发 📋

| API | 路径 | 优先级 |
|-----|------|--------|
| Run 列表 | `runsApi.list()` | P1 |
| Run 详情 | `runsApi.get(id)` | P1 |
| 审计日志 | `auditApi.list()` | P2 |

---

## Store 状态

### consoleStore.ts ✅
```typescript
interface ConsoleState {
  // 选中状态
  selectedProjectId: string | null;
  selectedSessionId: string | null;
  selectedRunId: string | null;
  selectedToolCallId: string | null;
  selectedApprovalId: string | null;

  // 数据
  sessions: Session[];
  currentRun: Run | null;
  messages: Message[];
  toolCalls: ToolCall[];
  approvals: ApprovalRequest[];
  steps: AgentStep[];
  fileDiffs: FileDiff[];

  // UI 状态
  isStreaming: boolean;
  streamContent: string;
  isConnected: boolean;
}
```

### Store Actions ✅
| Action | 说明 |
|--------|------|
| `setSelectedSession` | 设置选中的会话 |
| `setSelectedRun` | 设置选中的 Run |
| `setCurrentRun` | 设置当前 Run |
| `setMessages` | 设置消息列表 |
| `addMessage` | 添加消息 |
| `appendStreamContent` | 追加流式内容 |
| `clearStreamContent` | 清空流式内容 |
| `setToolCalls` | 设置工具调用列表 |
| `addToolCall` | 添加工具调用 |
| `updateToolCall` | 更新工具调用 |
| `setApprovals` | 设置审批列表 |
| `addApproval` | 添加审批请求 |
| `updateApproval` | 更新审批请求 |
| `setSteps` | 设置步骤列表 |
| `addStep` | 添加步骤 |
| `updateStep` | 更新步骤 |
| `setFileDiffs` | 设置文件差异列表 |
| `addFileDiff` | 添加文件差异 |
| `setIsStreaming` | 设置流式状态 |
| `setIsConnected` | 设置连接状态 |

---

## 实时通信

### runEvents.ts (SSE) ✅ 已完成
- [x] 连接建立
- [x] 事件监听机制
- [x] 事件处理器注册 (连接到 Store)
- [x] 重连逻辑 (指数退避)

#### 已实现的事件处理 ✅

| 事件类型 | 处理逻辑 | Store Action |
|----------|----------|--------------|
| `message.delta` | 追加流式内容 | `appendStreamContent` |
| `message.created` | 添加消息 | `addMessage` |
| `message.completed` | 添加消息+清空流式 | `addMessage` + `clearStreamContent` |
| `tool_call.created` | 添加工具调用 | `addToolCall` |
| `tool_call.pending_approval` | 更新状态+添加审批 | `updateToolCall` + `addApproval` |
| `tool_call.started` | 更新工具调用状态 | `updateToolCall` |
| `tool_call.completed` | 更新工具调用结果 | `updateToolCall` |
| `tool_call.failed` | 更新工具调用错误 | `updateToolCall` |
| `step.started` | 添加步骤 | `addStep` |
| `step.completed` | 更新步骤 | `updateStep` |
| `approval.created` | 添加审批请求 | `addApproval` |
| `approval.resolved` | 更新审批状态 | `updateApproval` |
| `file_diff.created` | 添加文件差异 | `addFileDiff` |
| `run.started` | 更新 Run 状态 | `setCurrentRun` + `setIsStreaming(true)` |
| `run.completed` | 更新 Run 状态 | `setCurrentRun` + `setIsStreaming(false)` |
| `run.failed` | 更新 Run 错误状态 | `setCurrentRun` + `setIsStreaming(false)` |
| `run.cancelled` | 更新 Run 取消状态 | `setCurrentRun` + `setIsStreaming(false)` |
| `log.created` | 添加日志 | `addLog` (待实现) |

### controlSocket.ts (WebSocket) ✅ 已完成
- [x] 连接建立
- [x] 消息发送
- [x] 事件监听机制
- [x] 审批操作 (approve/reject/edit)
- [x] Store 事件处理 (approval.resolved, run.status_changed)

---

## ConversationPanel 增强 ✅

### 已实现
- [x] 选中会话时自动加载历史消息
- [x] 创建新 Run 时清理旧 Run 数据
- [x] 设置 `selectedRunId` 到 Store
- [x] 消息加载 Loading 状态

### Run 启动流程
```typescript
1. 清空旧 Run 数据 (toolCalls, approvals, steps, fileDiffs, logs)
2. 添加用户消息到本地
3. 调用 runsApi.create() 创建 Run
4. 设置 setCurrentRun(run) 和 setSelectedRun(run.id)
5. 调用 runEventsService.connect(run.id) 连接 SSE
6. SSE 事件自动更新 Store
```

---

## Logs Panel ✅ 新增

### 功能
- [x] 实时日志展示
- [x] 按级别过滤 (debug, info, warn, error)
- [x] 关键词搜索
- [x] 自动过滤计数显示
- [x] Auto-scroll 开关

### 组件
- `LogsPanel.tsx` - 日志面板组件

### Store 扩展
```typescript
logs: LogEntry[];
logFilter: {
  level: LogLevel | null;
  keyword: string;
};
setLogs: (logs: LogEntry[]) => void;
addLog: (log: LogEntry) => void;
setLogFilter: (filter: { level?: LogLevel | null; keyword?: string }) => void;
```

### SSE 事件
| 事件 | 处理 |
|------|------|
| `log.created` | `addLog(log)` |

---

## 待完成功能

### P0 (MVP 必须)
- [x] **SSE 事件完整处理** - 已实现所有事件类型
- [x] **审批卡片 UI 和操作** - Approve/Reject/Edit & Approve
- [x] 流式输出 Markdown 渲染

### P1 (重要)
- [x] **日志面板** - 实时日志展示 + 搜索过滤 ✅
- [ ] Run 列表页面
- [ ] 文件 Diff 展示 (Monaco Editor)
- [ ] 断线重连状态恢复

### P2 (增强)
- [ ] Token 统计展示
- [ ] 成本估算
- [ ] 审计日志查询

---

## 新增依赖 📦

| 依赖 | 版本 | 用途 |
|------|------|------|
| react-markdown | latest | Markdown 渲染 |

---

## 技术债务 / 优化
- [ ] 错误边界处理
- [ ] 加载状态统一管理
- [ ] 离线/网络异常处理
- [ ] 虚拟列表优化 (大量消息时)
- [ ] SSE 断开后自动重连的状态同步

---

## 新增需求 (2026-05-07)

### 日志面板

**需求描述**：
- 实时展示结构化日志
- 支持按级别过滤 (debug, info, warn, error)
- 支持关键词搜索
- 日志格式: `[时间戳] [级别] 内容`

**数据结构**：
```typescript
interface LogEntry {
  id: string;
  run_id: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}
```

**Store 扩展**：
```typescript
interface ConsoleState {
  // ... existing
  logs: LogEntry[];
  logFilter: {
    level: string | null;  // debug, info, warn, error
    keyword: string;
  };
}
```

**事件类型**：
| 事件 | payload | 说明 |
|------|---------|------|
| `log.created` | `{log: LogEntry}` | 新日志 |

**API 需求**：
```
GET /api/runs/{run_id}/logs
Response: { logs: LogEntry[], total: number }
```

---

## API 需求清单

### 后端待实现

| API | 方法 | 路径 | 优先级 |
|-----|------|------|--------|
| Run 日志列表 | GET | `/api/runs/{run_id}/logs` | P1 |
| Run 列表 | GET | `/api/runs` | P1 |
| Run 详情 | GET | `/api/runs/{run_id}` | P1 |
| 审计日志 | GET | `/api/audit_logs` | P2 |

### 后端已实现

| API | 方法 | 路径 |
|-----|------|------|
| 会话列表 | GET | `/api/sessions` |
| 创建会话 | POST | `/api/sessions` |
| 删除会话 | DELETE | `/api/sessions/{id}` |
| 会话消息 | GET | `/api/sessions/{id}/messages` |
| 创建 Run | POST | `/api/runs` |
| 取消 Run | POST | `/api/runs/{run_id}/cancel` |
| SSE 事件 | GET | `/api/runs/{run_id}/events` |
