# Agent Console Technical Design

## 1. Summary

This document defines the recommended technical design for an Agent Console / Agent Workbench GUI.

The system should be built as a Web-first console with a reusable Agent Core. The Web client is the first target. A Tauri desktop client can be added later by reusing the React frontend and connecting it to a local sidecar runtime.

Recommended stack:

```text
Frontend:
  Next.js + React + TypeScript + Tailwind + shadcn/ui

Backend API:
  FastAPI

Agent Runtime:
  Python + LangGraph or custom Python runtime

Realtime:
  SSE for model and step streaming
  WebSocket for bidirectional control

Storage:
  PostgreSQL for structured run data
  Redis for queue, cache, and session coordination
  S3-compatible object storage for artifacts

Observability:
  OpenTelemetry-compatible traces, logs, and metrics
```

## 2. Architecture

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

+-----------------------+
| Object Storage        |
| files / artifacts     |
+-----------------------+
```

## 3. Client Design

### 3.1 Frontend Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js |
| UI Runtime | React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Component System | shadcn/ui + Radix UI |
| Server State | TanStack Query |
| Client State | Zustand or Jotai |
| Flow View | React Flow |
| Code Editor | Monaco Editor |
| Diff Viewer | Monaco Diff Editor or react-diff-viewer |
| Logs | react-virtuoso or react-window |
| Markdown | react-markdown |
| Tables | TanStack Table |

### 3.2 Main Client Modules

```text
app/
  console/
    page.tsx
    components/
      SessionSidebar.tsx
      ConversationPanel.tsx
      InspectorPanel.tsx
      RunTimeline.tsx
      LogsPanel.tsx
      ApprovalCard.tsx
      ToolCallView.tsx
      FileDiffView.tsx

lib/
  api/
    client.ts
    runs.ts
    sessions.ts
    approvals.ts
  realtime/
    runEvents.ts
    controlSocket.ts
  stores/
    consoleStore.ts
```

### 3.3 UI State Model

The client should separate:

- Server state: sessions, runs, messages, tool calls, approvals.
- Realtime event stream: run events, token deltas, step updates.
- Local UI state: selected run, selected tool call, open panels, filters.

Do not store the canonical run state only in the browser. The server should be able to reconstruct the UI after reconnect.

## 4. Backend Design

### 4.1 API Service

The API service owns:

- Authentication and authorization.
- Project/session/run CRUD.
- Starting and cancelling runs.
- Streaming run events.
- Receiving approval decisions.
- Reading logs, tool calls, diffs, and artifacts.

Recommended API categories:

```text
POST   /api/runs
GET    /api/runs/{run_id}
GET    /api/runs/{run_id}/events
POST   /api/runs/{run_id}/cancel

GET    /api/sessions
GET    /api/sessions/{session_id}
POST   /api/sessions/{session_id}/messages

GET    /api/tool-calls/{tool_call_id}
POST   /api/approvals/{approval_id}/approve
POST   /api/approvals/{approval_id}/reject
POST   /api/approvals/{approval_id}/edit

GET    /api/runs/{run_id}/logs
GET    /api/runs/{run_id}/diffs
```

### 4.2 Agent Runtime

The Agent Runtime owns:

- Model calls.
- Tool planning.
- Tool execution through the Tool Gateway.
- Human-in-the-loop interrupts.
- Run state transitions.
- Emitting structured events.

The runtime should emit events rather than UI-specific messages.

Example event types:

```text
run.started
message.created
message.delta
message.completed
step.started
tool_call.created
tool_call.pending_approval
tool_call.started
tool_call.completed
tool_call.failed
approval.created
approval.resolved
file_diff.created
log.created
run.completed
run.failed
run.cancelled
```

## 5. Realtime Design

### 5.1 SSE

Use SSE for:

- Token streaming.
- Agent step events.
- Tool-call lifecycle updates.
- Log events.
- Run status updates.

SSE endpoint:

```text
GET /api/runs/{run_id}/events
```

Each event should include:

```json
{
  "event_id": "evt_123",
  "run_id": "run_123",
  "type": "tool_call.pending_approval",
  "created_at": "2026-05-07T10:00:00Z",
  "payload": {}
}
```

The server should persist events or enough state to recover the UI after reconnect.

### 5.2 WebSocket

Use WebSocket for bidirectional control:

- Cancel run.
- Approve tool call.
- Reject tool call.
- Edit tool-call arguments.
- Interactive terminal or shell in later versions.

Do not put all application data into WebSocket. REST and SSE should remain the default for query and stream behavior.

## 6. Human-In-The-Loop Design

Every tool should declare a policy:

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

Approval decisions:

```text
approve: execute as proposed
edit: modify arguments and execute
reject: do not execute and return feedback to agent
```

Tool calls that modify files, execute shell commands, access credentials, query production databases, or delete data should require explicit approval by default.

## 7. Data Model

### 7.1 Core Tables

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

### 7.2 Important Fields

`runs`:

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

`tool_calls`:

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

`approval_requests`:

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

`audit_logs`:

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

## 8. Tool Gateway

The Tool Gateway should be the only layer allowed to execute tools.

Responsibilities:

- Validate arguments against schema.
- Classify risk.
- Check permissions.
- Create previews when possible.
- Pause for approval when required.
- Execute tools in a controlled environment.
- Record results and audit logs.

This boundary matters because agent-generated tool calls should not directly touch files, shell, databases, or secrets.

## 9. Desktop Design

After the Web MVP, add a Tauri desktop shell:

```text
Desktop Shell:
  Tauri + Rust

UI:
  Reused React + TypeScript frontend

Local Runtime:
  Python sidecar or Node sidecar

Local Storage:
  SQLite

Communication:
  localhost WebSocket, stdio, or gRPC
```

Rust should own local permissions:

- Allowed workspace directories.
- Shell command policy.
- Environment variable access.
- Secret storage.
- Sidecar lifecycle.
- Local audit log.

The Agent Runtime should remain separate so Web, Desktop, IDE, and TUI clients can reuse the same core behavior.

## 10. Observability

Use an OpenTelemetry-compatible event model from the beginning.

Track:

- Trace ID per run.
- Span per model call.
- Span per tool call.
- Latency per step.
- Token usage.
- Estimated cost.
- Error type and stack.
- Approval wait time.

Early versions can store this in PostgreSQL and logs. Later versions can export through OpenTelemetry Collector.

## 11. Security

Baseline security requirements:

- Authentication before accessing projects and runs.
- Project-level authorization.
- Server-side approval enforcement.
- Tool argument validation.
- Audit log for all sensitive actions.
- No direct browser access to secrets.
- File access limited by project/workspace policy.
- Shell execution denied by default unless explicitly enabled.

For desktop, Rust should enforce local capability boundaries rather than trusting the web UI.

## 12. Testing Strategy

### Frontend

- Component tests for approval cards, timeline, tool-call inspector, and diff viewer.
- Integration tests for streaming event handling.
- Browser tests for layout and reconnect flows.

### Backend

- Unit tests for tool policies and approval rules.
- API tests for run creation, approval decisions, and cancellation.
- Worker tests for event emission and run state transitions.

### End-To-End

- Start a run and stream a response.
- Trigger a safe tool call.
- Trigger a high-risk tool call and approve it.
- Reject a tool call and verify the agent receives feedback.
- Reconnect to an active run and reconstruct UI state.
- Generate a file diff and review it.

## 13. Implementation Phases

### Phase 1: Foundation

- Initialize Next.js app.
- Initialize FastAPI service.
- Add PostgreSQL schema.
- Add sessions, messages, and runs.
- Add basic console layout.

### Phase 2: Realtime Runs

- Add run worker.
- Add SSE run events.
- Stream model output.
- Render run timeline.

### Phase 3: Tool Calls And Approval

- Add Tool Gateway.
- Add tool-call persistence.
- Add approval request model.
- Add approve, edit, reject actions.
- Add audit records.

### Phase 4: Files And Logs

- Add structured logs.
- Add file artifact model.
- Add file diff viewer.
- Add patch approval flow.

### Phase 5: Production Readiness

- Add authentication.
- Add project permissions.
- Add reconnect recovery.
- Add OpenTelemetry export path.
- Containerize API and worker.

### Phase 6: Desktop Packaging

- Add Tauri shell.
- Add Rust local capability bridge.
- Add local sidecar lifecycle.
- Add SQLite storage mode.
- Add desktop packaging and auto-update.

## 14. Key Technical Decisions

1. Use Web-first architecture to reduce early desktop complexity.
2. Keep Agent Runtime separate from UI and API routing.
3. Use SSE for one-way streaming and WebSocket for control.
4. Treat tool execution as a permissioned gateway, not a direct agent capability.
5. Persist run events or reconstructable state for recovery.
6. Use TypeScript for UI and Python for Agent Runtime by default.
7. Add Tauri only after the core Agent Console loop is stable.

## 15. References

- React 19: https://react.dev/blog/2024/12/05/react-19
- Next.js App Router: https://nextjs.org/docs/app
- LangChain Human-in-the-Loop: https://docs.langchain.com/oss/python/langchain/frontend/human-in-the-loop
- Tauri Architecture: https://v2.tauri.app/concept/architecture/
- OpenTelemetry Documentation: https://opentelemetry.io/docs/
- MDN Server-Sent Events: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events

