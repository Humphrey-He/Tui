import type { ApprovalDecision } from "@/types";
import { useConsoleStore } from "@/stores/consoleStore";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

type MessageHandler = (data: unknown) => void;

class ControlSocketService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageQueue: Array<{ type: string; data: unknown }> = [];

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(`${WS_URL}/api/ws/control`);
    this.reconnectAttempts = 0;
    this.registerStoreHandlers();

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.flushQueue();
      this.emit("connected", {});
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, ...data } = message;
        this.emit(type, data);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    this.ws.onerror = () => {
      this.emit("disconnected", {});
    };

    this.ws.onclose = () => {
      this.emit("disconnected", {});
      this.attemptReconnect();
    };
  }

  private registerStoreHandlers(): void {
    // 监听审批结果，更新 store 中的审批状态
    this.on("approval.resolved", (data) => {
      const { approval_id, decision, reason } = data as {
        approval_id: string;
        decision: ApprovalDecision;
        reason?: string;
      };
      useConsoleStore.getState().updateApproval(approval_id, {
        status: "resolved",
        decision,
        decision_reason: reason,
        decided_at: new Date().toISOString(),
      });
    });

    // 监听 Run 状态变化
    this.on("run.status_changed", (data) => {
      const { run_id, status } = data as { run_id: string; status: string };
      const currentRun = useConsoleStore.getState().currentRun;
      if (currentRun && currentRun.id === run_id) {
        useConsoleStore.getState().setCurrentRun({
          ...currentRun,
          status: status as any,
        });
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max WebSocket reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        this.send(msg.type, msg.data);
      }
    }
  }

  private emit(type: string, data: unknown): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  send(type: string, data?: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    } else {
      this.messageQueue.push({ type, data });
    }
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  off(type: string, handler: MessageHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  // Control actions
  cancelRun(runId: string): void {
    this.send("cancel_run", { run_id: runId });
  }

  approveToolCall(approvalId: string, reason?: string): void {
    this.send("approve_tool_call", { approval_id: approvalId, reason });
  }

  rejectToolCall(approvalId: string, reason?: string): void {
    this.send("reject_tool_call", { approval_id: approvalId, reason });
  }

  editToolCall(
    approvalId: string,
    editedArgs: Record<string, unknown>,
    reason?: string
  ): void {
    this.send("edit_tool_call", {
      approval_id: approvalId,
      edited_args: editedArgs,
      reason,
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
    this.messageQueue = [];
  }
}

export const controlSocketService = new ControlSocketService();
