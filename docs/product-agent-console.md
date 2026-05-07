# Agent Console Product Document

## 1. Product Positioning

Agent Console is a control console and workbench for AI agents. It is not just a chat UI. Its core value is making agent execution visible, controllable, auditable, and recoverable.

The product should support model streaming, tool calls, task progress, human approvals, execution logs, file diffs, session history, and permission boundaries.

The recommended landing path is:

```text
Build the Web Agent Console first.
Then reuse the frontend and Agent Core to package a Tauri desktop version.
```

## 2. Target Users

### Primary Users

- Developers using agents to read, modify, and run code.
- AI application builders who need to debug agent workflows.
- Internal platform teams building controlled agent execution environments.

### Secondary Users

- Product and operation teams reviewing agent task progress.
- Security and compliance reviewers checking tool-call audit trails.
- Team leads monitoring usage, cost, and failure patterns.

## 3. Core Product Goals

1. Make agent behavior inspectable.
2. Let users approve, reject, or edit sensitive tool calls.
3. Preserve run history, logs, tool results, and file changes.
4. Support long-running tasks with reconnect and recovery.
5. Provide a reusable Agent Core for Web, Desktop, IDE, and future TUI clients.

## 4. Non-Goals For MVP

The first version should avoid becoming a full IDE or enterprise platform.

Out of scope for MVP:

- Multi-tenant enterprise billing.
- Plugin marketplace.
- Visual DAG workflow editor.
- Full collaborative editing.
- Advanced multi-agent orchestration UI.
- Complete RBAC matrix.
- Custom observability backend.

These can be added after the core execution loop is stable.

## 5. MVP Scope

The MVP should include:

| Module | Description |
| --- | --- |
| Session List | Browse and resume conversations and runs. |
| Agent Conversation | Show user messages, model streaming output, and status. |
| Run Timeline | Show model calls, tool calls, approval pauses, errors, and completion. |
| Tool Call Inspector | Show tool name, arguments, result, error, latency, and risk level. |
| Human Approval | Approve, reject, or edit sensitive actions before execution. |
| Logs Panel | Show structured execution logs with levels and timestamps. |
| File Diff Viewer | Preview file changes and patch-like modifications. |
| Persistence | Store messages, runs, tool calls, approvals, logs, and artifacts. |
| Basic Audit Log | Record who approved what and when. |

## 6. Key User Workflows

### 6.1 Start A Run

1. User selects a project or session.
2. User enters an instruction.
3. Agent starts a run.
4. UI streams model output and step events.
5. Timeline updates as the run progresses.

### 6.2 Review A Tool Call

1. Agent proposes a tool call.
2. Backend classifies risk and checks approval policy.
3. If approval is required, run pauses.
4. UI shows a review card with arguments, preview, and risk explanation.
5. User chooses approve, edit, or reject.
6. Backend resumes the run with the decision.

### 6.3 Review File Changes

1. Agent generates or modifies files.
2. UI shows changed files in the Inspector.
3. User opens a diff view.
4. User approves, rejects, or asks the agent to revise.
5. Audit log records the decision.

### 6.4 Recover A Long-Running Task

1. User reconnects after closing the browser or losing network.
2. Client reloads sessions and active runs.
3. SSE resumes from the latest available event when possible.
4. UI reconstructs conversation, timeline, logs, and pending approvals.

## 7. Information Architecture

Recommended layout:

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

### Main Pages

| Page | Purpose |
| --- | --- |
| Console | Main agent conversation and run control. |
| Runs | Historical and active run list. |
| Approval Inbox | Central list of pending human decisions. |
| Files | File tree, artifacts, and diffs. |
| Trace | Latency, token usage, cost, spans, and errors. |
| Settings | Models, tools, permissions, environment variables, prompts. |
| Audit Log | Security and compliance record. |

## 8. UX Principles

1. The user should always know what the agent is doing.
2. Dangerous actions should be previewed before execution.
3. The interface should separate conversation, execution state, and inspection.
4. Logs and traces should be searchable and filterable.
5. Streaming output should be interruptible.
6. Every approval decision should be recorded.
7. The UI should stay useful during partial failure, reconnect, and retry.

## 9. Product Metrics

Useful early metrics:

- Run completion rate.
- Tool-call success rate.
- Approval rate by tool and risk level.
- Rejection rate and rejection reasons.
- Average run duration.
- Time spent waiting for human approval.
- Token usage and estimated cost per run.
- Error frequency by tool.
- Recovered sessions after reconnect.

## 10. Product Roadmap

### Phase 1: Agent Console MVP

- Sessions and messages.
- Streaming model output.
- Run timeline.
- Tool call inspector.
- Human approval flow.
- File diff preview.
- Basic logs and audit records.

### Phase 2: Production Web Console

- Authentication.
- Project-level permissions.
- Better run recovery.
- Searchable run history.
- Token and cost tracking.
- OpenTelemetry integration.
- Deployment with containerized backend and workers.

### Phase 3: Desktop Client

- Tauri shell.
- Local file and shell permission boundary.
- Python or Node sidecar.
- SQLite local storage.
- Local project indexing.
- Desktop auto-update.

### Phase 4: Platform Capabilities

- Multi-agent status.
- Team approval workflows.
- Advanced audit exports.
- Custom tool registry.
- IDE integration.
- Enterprise SSO and RBAC.

## 11. Recommended Product Decision

Start with a Web Agent Console MVP:

```text
Next.js + React + TypeScript + Tailwind + shadcn/ui
FastAPI + Python Agent Runtime
PostgreSQL + Redis
SSE + WebSocket
OpenTelemetry-ready event model
```

After the MVP proves the agent execution loop, package the same UI into a Tauri desktop client and reuse the Agent Core.

