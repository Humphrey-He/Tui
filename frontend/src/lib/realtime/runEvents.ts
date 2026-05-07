import { apiClient } from "@/lib/api/client";
import { useConsoleStore } from "@/stores/consoleStore";
import type {
  RunEvent,
  RunEventType,
  Message,
  ToolCall,
  ApprovalRequest,
  AgentStep,
  FileDiff,
} from "@/types";

type EventHandler = (event: RunEvent) => void;

class RunEventsService {
  private eventSource: EventSource | null = null;
  private handlers: Map<RunEventType, Set<EventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private runId: string | null = null;

  connect(runId: string): void {
    this.runId = runId;
    this.reconnectAttempts = 0;
    this.registerStoreHandlers();
    this.createEventSource();
  }

  private registerStoreHandlers(): void {
    // message.delta - 流式输出片段
    this.on("message.delta", (event) => {
      const { content } = event.payload as { content: string };
      useConsoleStore.getState().appendStreamContent(content);
    });

    // message.completed - 消息完成，保存到列表
    this.on("message.completed", (event) => {
      const { message } = event.payload as { message: Message };
      useConsoleStore.getState().addMessage(message);
      useConsoleStore.getState().clearStreamContent();
    });

    // message.created - 新消息创建
    this.on("message.created", (event) => {
      const { message } = event.payload as { message: Message };
      useConsoleStore.getState().addMessage(message);
    });

    // tool_call.created - 工具调用创建
    this.on("tool_call.created", (event) => {
      const { tool_call } = event.payload as { tool_call: ToolCall };
      useConsoleStore.getState().addToolCall(tool_call);
    });

    // tool_call.pending_approval - 等待审批
    this.on("tool_call.pending_approval", (event) => {
      const { tool_call, approval } = event.payload as {
        tool_call: ToolCall;
        approval: ApprovalRequest;
      };
      useConsoleStore.getState().updateToolCall(tool_call.id, {
        status: "pending_approval",
      });
      useConsoleStore.getState().addApproval(approval);
    });

    // tool_call.started - 工具调用开始
    this.on("tool_call.started", (event) => {
      const { tool_call } = event.payload as { tool_call: ToolCall };
      useConsoleStore.getState().updateToolCall(tool_call.id, {
        status: "running",
      });
    });

    // tool_call.completed - 工具调用完成
    this.on("tool_call.completed", (event) => {
      const { tool_call } = event.payload as { tool_call: ToolCall };
      useConsoleStore.getState().updateToolCall(tool_call.id, {
        status: "completed",
        result: tool_call.result,
        completed_at: tool_call.completed_at,
      });
    });

    // tool_call.failed - 工具调用失败
    this.on("tool_call.failed", (event) => {
      const { tool_call } = event.payload as { tool_call: ToolCall };
      useConsoleStore.getState().updateToolCall(tool_call.id, {
        status: "failed",
        error_message: tool_call.error_message,
        completed_at: tool_call.completed_at,
      });
    });

    // step.started - 步骤开始
    this.on("step.started", (event) => {
      const { step } = event.payload as { step: AgentStep };
      useConsoleStore.getState().addStep(step);
    });

    // step.completed - 步骤完成
    this.on("step.completed", (event) => {
      const { step } = event.payload as { step: AgentStep };
      useConsoleStore.getState().updateStep(step.id, step);
    });

    // approval.created - 审批请求创建
    this.on("approval.created", (event) => {
      const { approval } = event.payload as { approval: ApprovalRequest };
      useConsoleStore.getState().addApproval(approval);
    });

    // approval.resolved - 审批已处理
    this.on("approval.resolved", (event) => {
      const { approval } = event.payload as { approval: ApprovalRequest };
      useConsoleStore.getState().updateApproval(approval.id, {
        status: "resolved",
        decision: approval.decision,
        decision_reason: approval.decision_reason,
        decided_at: approval.decided_at,
      });
    });

    // file_diff.created - 文件差异创建
    this.on("file_diff.created", (event) => {
      const { file_diff } = event.payload as { file_diff: FileDiff };
      useConsoleStore.getState().addFileDiff(file_diff);
    });

    // run.started - Run 启动
    this.on("run.started", (event) => {
      const { run_id, status } = event.payload as {
        run_id: string;
        status: string;
      };
      const currentRun = useConsoleStore.getState().currentRun;
      if (currentRun && currentRun.id === run_id) {
        useConsoleStore.getState().setCurrentRun({
          ...currentRun,
          status: status as any,
        });
      }
      useConsoleStore.getState().setIsStreaming(true);
    });

    // run.completed - Run 完成
    this.on("run.completed", (event) => {
      const { run_id, total_tokens, estimated_cost } = event.payload as {
        run_id: string;
        total_tokens?: number;
        estimated_cost?: number;
      };
      const currentRun = useConsoleStore.getState().currentRun;
      if (currentRun && currentRun.id === run_id) {
        useConsoleStore.getState().setCurrentRun({
          ...currentRun,
          status: "completed",
          total_tokens: total_tokens ?? currentRun.total_tokens,
          estimated_cost: estimated_cost ?? currentRun.estimated_cost,
        });
      }
      useConsoleStore.getState().setIsStreaming(false);
      useConsoleStore.getState().clearStreamContent();
    });

    // run.failed - Run 失败
    this.on("run.failed", (event) => {
      const { run_id, error } = event.payload as {
        run_id: string;
        error?: string;
      };
      const currentRun = useConsoleStore.getState().currentRun;
      if (currentRun && currentRun.id === run_id) {
        useConsoleStore.getState().setCurrentRun({
          ...currentRun,
          status: "failed",
          error_message: error,
        });
      }
      useConsoleStore.getState().setIsStreaming(false);
      useConsoleStore.getState().clearStreamContent();
    });

    // run.cancelled - Run 取消
    this.on("run.cancelled", (event) => {
      const { run_id } = event.payload as { run_id: string };
      const currentRun = useConsoleStore.getState().currentRun;
      if (currentRun && currentRun.id === run_id) {
        useConsoleStore.getState().setCurrentRun({
          ...currentRun,
          status: "cancelled",
        });
      }
      useConsoleStore.getState().setIsStreaming(false);
      useConsoleStore.getState().clearStreamContent();
    });
  }

  private createEventSource(): void {
    if (!this.runId) return;

    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/runs/${this.runId}/events`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
      useConsoleStore.getState().setIsConnected(true);
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data: RunEvent = JSON.parse(event.data);
        this.emit(data);
      } catch (error) {
        console.error("Failed to parse SSE event:", error);
      }
    };

    this.eventSource.onerror = () => {
      this.eventSource?.close();
      useConsoleStore.getState().setIsConnected(false);
      this.attemptReconnect();
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.createEventSource();
    }, delay);
  }

  private emit(event: RunEvent): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => handler(event));
    }
  }

  on(eventType: RunEventType, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  off(eventType: RunEventType, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.handlers.clear();
    this.runId = null;
    useConsoleStore.getState().setIsConnected(false);
  }
}

export const runEventsService = new RunEventsService();
