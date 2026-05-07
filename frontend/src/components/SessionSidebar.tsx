"use client";

import { useState, useEffect } from "react";
import { useConsoleStore } from "@/stores/consoleStore";
import { sessionsApi } from "@/lib/api/sessions";
import { projectsApi } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2, Loader2 } from "lucide-react";

export function SessionSidebar() {
  const {
    sessions,
    selectedSessionId,
    selectedProjectId,
    setSelectedSession,
    setSelectedProject,
    setSessions,
    addSession,
  } = useConsoleStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeProject();
  }, []);

  const initializeProject = async () => {
    try {
      setIsLoading(true);

      // Try to get existing projects
      const projects = await projectsApi.list();

      if (projects.length > 0) {
        // Use existing project
        setSelectedProject(projects[0].id);
        await loadSessions(projects[0].id);
      } else {
        // Create a default project
        const newProject = await projectsApi.create({
          name: "Default Project",
          description: "Default project for Agent Console",
        });
        setSelectedProject(newProject.id);
        setSessions([]);
      }
    } catch (error) {
      console.error("Failed to initialize project:", error);
      // Try to create a default project even if list fails
      try {
        const newProject = await projectsApi.create({
          name: "Default Project",
        });
        setSelectedProject(newProject.id);
        setSessions([]);
      } catch (e) {
        console.error("Failed to create default project:", e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessions = async (projectId: string) => {
    try {
      const response = await sessionsApi.list(projectId);
      setSessions(response.sessions);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadSessions(selectedProjectId);
    }
  }, [selectedProjectId]);

  const handleCreateSession = async () => {
    if (!newSessionName.trim() || !selectedProjectId) return;

    try {
      const session = await sessionsApi.create({
        project_id: selectedProjectId,
        name: newSessionName,
      });
      addSession(session);
      setSelectedSession(session.id);
      setNewSessionName("");
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to create session:", error);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await sessionsApi.delete(sessionId);
      setSessions(sessions.filter((s) => s.id !== sessionId));
      if (selectedSessionId === sessionId) {
        setSelectedSession(null);
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
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
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No sessions yet
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session.id)}
                className={`group w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedSessionId === session.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                <span className="truncate flex-1 text-left">
                  {session.name}
                </span>
                <button
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
