"use client";

import { useState, useRef, useEffect } from "react";
import { useConsoleStore } from "@/stores/consoleStore";
import { sessionsApi } from "@/lib/api/sessions";
import { runsApi } from "@/lib/api/runs";
import { runEventsService } from "@/lib/realtime/runEvents";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Loader2,
  SendHorizontal,
  Sparkles,
  Square,
  User,
  Wand2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const STARTER_PROMPTS = [
  "Review the latest run and summarize risks",
  "Inspect file changes and prepare approval notes",
  "Create a step-by-step execution plan",
];

export function ConversationPanel() {
  const {
    selectedSessionId,
    messages,
    currentRun,
    isStreaming,
    streamContent,
    setMessages,
    addMessage,
    setCurrentRun,
    setSelectedRun,
    setIsStreaming,
    clearStreamContent,
    setToolCalls,
    setApprovals,
    setSteps,
    setFileDiffs,
    setLogs,
  } = useConsoleStore();

  const [input, setInput] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load messages when session is selected
  useEffect(() => {
    if (selectedSessionId) {
      loadMessages(selectedSessionId);
    } else {
      setMessages([]);
    }
  }, [selectedSessionId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamContent]);

  const loadMessages = async (sessionId: string) => {
    try {
      setIsLoadingMessages(true);
      const response = await sessionsApi.messages(sessionId);
      setMessages(response.messages);
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleStartRun = async () => {
    if (!input.trim() || !selectedSessionId) return;

    const prompt = input.trim();
    setSendError(null);

    // Clear previous run data
    setToolCalls([]);
    setApprovals([]);
    setSteps([]);
    setFileDiffs([]);
    setLogs([]);
    clearStreamContent();

    const userMessage = {
      id: `msg_${Date.now()}`,
      session_id: selectedSessionId,
      role: "user" as const,
      content: prompt,
      created_at: new Date().toISOString(),
    };
    addMessage(userMessage);
    setInput("");

    try {
      setIsStreaming(true);

      const run = await runsApi.create({
        session_id: selectedSessionId,
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: prompt },
        ],
      });
      setCurrentRun(run);
      setSelectedRun(run.id);

      runEventsService.connect(run.id);
    } catch (error) {
      console.error("Failed to start run:", error);
      setSendError(
        error instanceof Error ? error.message : "Failed to start the run"
      );
      setIsStreaming(false);
    }
  };

  const handleCancelRun = () => {
    if (!currentRun) return;
    runsApi.cancel(currentRun.id);
    setIsStreaming(false);
    runEventsService.disconnect();
  };

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,249,252,0.92))]">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Agent Conversation
          </h2>
          <p className="text-xs text-muted-foreground">
            Stream model reasoning, tool events, and human decisions in one run.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent-foreground" />
          {currentRun ? (
            <span className="capitalize">{currentRun.status}</span>
          ) : (
            <span>Ready</span>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 px-5 py-5" ref={scrollRef}>
        <div className="mx-auto max-w-4xl space-y-5">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                <Wand2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight">
                Start a controlled agent run
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                Ask the agent to inspect, plan, or modify work. Tool calls,
                approvals, logs, and diffs will appear around the conversation.
              </p>
              <div className="mt-6 grid w-full max-w-2xl gap-2 md:grid-cols-3">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    disabled={!selectedSessionId || isStreaming}
                    className="rounded-xl border bg-background p-3 text-left text-xs font-medium leading-5 shadow-sm transition hover:border-primary/30 hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}

          {isStreaming && streamContent && (
            <div className="flex items-start gap-3">
              <Avatar role="assistant" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-semibold">Agent</span>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                    streaming
                  </span>
                </div>
                <div
                  className="rounded-2xl rounded-tl-md border bg-card px-4 py-3 shadow-sm"
                >
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{streamContent}</ReactMarkdown>
                  </div>
                  <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t bg-background/85 p-4">
        <div className="mx-auto max-w-4xl">
          {sendError && (
            <div className="mb-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {sendError}
            </div>
          )}
          <div className="rounded-2xl border bg-card p-2 shadow-[0_16px_40px_rgba(24,35,60,0.10)]">
            <textarea
              placeholder={
                selectedSessionId
                  ? "Ask the agent to inspect, plan, change, or explain..."
                  : "Select or create a session first"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleStartRun();
                }
              }}
              disabled={!selectedSessionId || isStreaming}
              rows={3}
              className="max-h-40 min-h-[76px] w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="flex items-center justify-between gap-3 border-t px-2 pt-2">
              <div className="text-[11px] text-muted-foreground">
                Enter to send · Shift Enter for a new line
              </div>
              {isStreaming ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleCancelRun}
                  className="rounded-full px-4"
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop run
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleStartRun}
                  disabled={!selectedSessionId || !input.trim()}
                  className="rounded-full px-4 shadow-md"
                >
                  <SendHorizontal className="h-3.5 w-3.5" />
                  Send
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
}: {
  message: {
    id: string;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    created_at: string;
  };
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && <Avatar role="assistant" />}
      <div className={`min-w-0 ${isUser ? "max-w-[76%]" : "flex-1"}`}>
        <div
          className={`mb-1 flex items-center gap-2 ${
            isUser ? "justify-end" : ""
          }`}
        >
          <span className="text-xs font-semibold">
            {isUser ? "You" : "Agent"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(message.created_at).toLocaleTimeString()}
          </span>
        </div>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
            isUser
              ? "rounded-tr-md bg-primary text-primary-foreground"
              : "rounded-tl-md border bg-card"
          }`}
        >
          {message.role === "assistant" ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      </div>
      {isUser && <Avatar role="user" />}
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  const isUser = role === "user";

  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
        isUser
          ? "bg-primary text-primary-foreground"
          : "bg-accent text-accent-foreground"
      }`}
    >
      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
    </div>
  );
}
