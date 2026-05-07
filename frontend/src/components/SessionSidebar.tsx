"use client";

import { useState } from "react";
import { useConsoleStore } from "@/stores/consoleStore";
import { sessionsApi } from "@/lib/api/sessions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2 } from "lucide-react";

export function SessionSidebar() {
  const {
    sessions,
    selectedSessionId,
    setSelectedSession,
    setSessions,
  } = useConsoleStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;

    try {
      const session = await sessionsApi.create({
        project_id: "default",
        name: newSessionName,
      });
      setSessions([session, ...sessions]);
      setSelectedSession(session.id);
      setNewSessionName("");
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to create session:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Sessions</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {isCreating && (
          <div className="flex gap-2 mb-2">
            <Input
              placeholder="Session name..."
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateSession();
                if (e.key === "Escape") setIsCreating(false);
              }}
              className="h-8"
              autoFocus
            />
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No sessions yet
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedSessionId === session.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                <span className="truncate flex-1 text-left">
                  {session.name}
                </span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
