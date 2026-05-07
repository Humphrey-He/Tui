// Run types
export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface Run {
  id: string;
  project_id: string;
  session_id: string;
  status: RunStatus;
  started_by: string;
  started_at: string;
  completed_at?: string;
  cancelled_at?: string;
  error_message?: string;
  model: string;
  total_tokens: number;
  estimated_cost: number;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

// Session types
export interface Session {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  last_run_id?: string;
}

// Message types
export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface Message {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

// Tool Call types
export type ToolCallStatus =
  | "created"
  | "pending_approval"
  | "running"
  | "completed"
  | "failed"
  | "rejected";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ToolCall {
  id: string;
  run_id: string;
  step_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: ToolCallStatus;
  risk_level: RiskLevel;
  required_permission?: string;
  started_at: string;
  completed_at?: string;
  error_message?: string;
}

// Approval types
export type ApprovalDecision = "approved" | "rejected" | "edited";
export type ApprovalStatus = "pending" | "resolved";

export interface ApprovalRequest {
  id: string;
  run_id: string;
  tool_call_id: string;
  status: ApprovalStatus;
  requested_action: string;
  original_args: Record<string, unknown>;
  edited_args?: Record<string, unknown>;
  decision?: ApprovalDecision;
  decision_reason?: string;
  decided_by?: string;
  decided_at?: string;
  created_at: string;
}

// Agent Step types
export interface AgentStep {
  id: string;
  run_id: string;
  step_order: number;
  step_type: "message" | "tool_call" | "approval" | "error";
  status: "started" | "completed" | "failed";
  created_at: string;
  completed_at?: string;
}

// File Diff types
export interface FileDiff {
  id: string;
  run_id: string;
  file_path: string;
  change_type: "created" | "modified" | "deleted";
  diff_content: string;
  created_at: string;
}

// Audit Log types
export type AuditAction =
  | "run.created"
  | "run.cancelled"
  | "approval.approved"
  | "approval.rejected"
  | "approval.edited"
  | "tool_call.executed"
  | "file.created"
  | "file.modified"
  | "file.deleted";

export interface AuditLog {
  id: string;
  project_id: string;
  actor_id: string;
  action: AuditAction;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Event types for SSE
export type RunEventType =
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "run.cancelled"
  | "message.created"
  | "message.delta"
  | "message.completed"
  | "step.started"
  | "tool_call.created"
  | "tool_call.pending_approval"
  | "tool_call.started"
  | "tool_call.completed"
  | "tool_call.failed"
  | "approval.created"
  | "approval.resolved"
  | "file_diff.created"
  | "log.created";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  run_id: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface RunEvent {
  event_id: string;
  run_id: string;
  type: RunEventType;
  created_at: string;
  payload: Record<string, unknown>;
}
