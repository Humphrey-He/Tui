import { runsApi } from "@/lib/api/runs";
import type { RunEvent, RunEventType } from "@/types";

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
    this.createEventSource();
  }

  private createEventSource(): void {
    if (!this.runId) return;

    const url = runsApi.events(this.runId);
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
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
  }
}

export const runEventsService = new RunEventsService();
