"use client";

import { useState, useRef, useEffect } from "react";
import { useConsoleStore } from "@/stores/consoleStore";
import { sessionsApi } from "@/lib/api/sessions";
import { runsApi } from "@/lib/api/runs";
import { runEventsService } from "@/lib/realtime/runEvents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Square, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

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
    setIsStreaming,
    appendStreamContent,
    clearStreamContent,
  } = useConsoleStore();

  const [input, setInput] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
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

    const userMessage = {
      id: `msg_${Date.now()}`,
      session_id: selectedSessionId,
      role: "user" as const,
      content: input,
      created_at: new Date().toISOString(),
    };
    addMessage(userMessage);
    setInput("");

    try {
      setIsStreaming(true);
      clearStreamContent();

      const run = await runsApi.create({
        session_id: selectedSessionId,
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: input },
        ],
      });
      setCurrentRun(run);

      runEventsService.connect(run.id);
    } catch (error) {
      console.error("Failed to start run:", error);
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
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
              <p>No messages yet</p>
              <p className="text-xs mt-1">Select a session and start a conversation</p>
            </div>
          ) : (
            messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {message.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Streaming content */}
          {isStreaming && streamContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                <div className="prose prose-sm dark:prose-invert">
                  <ReactMarkdown>{streamContent}</ReactMarkdown>
                </div>
                <Loader2 className="h-4 w-4 animate-spin mt-2" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            placeholder={
              selectedSessionId
                ? "Type your message..."
                : "Select a session first"
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
            className="flex-1"
          />
          {isStreaming ? (
            <Button size="icon" variant="destructive" onClick={handleCancelRun}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleStartRun}
              disabled={!selectedSessionId || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
