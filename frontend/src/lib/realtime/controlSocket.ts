import type { ApprovalDecision } from "@/types";

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
    this.ws = new WebSocket(`${WS_URL}/api/ws/control`);
    this.reconnectAttempts = 0;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.flushQueue();
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
      this.attemptReconnect();
    };

    this.ws.onclose = () => {
      this.attemptReconnect();
    };
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
