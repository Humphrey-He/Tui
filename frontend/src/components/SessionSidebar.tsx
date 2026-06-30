"use client";

import { useState, useEffect } from "react";
import { useConsoleStore } from "@/stores/consoleStore";
import { sessionsApi } from "@/lib/api/sessions";
import { projectsApi } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Plus, Search, Trash2 } from "lucide-react";

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
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const filteredSessions = sessions.filter((session) =>
    session.name.toLowerCase().includes(search.toLowerCase())
  );

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
    <div className="flex h-full flex-col bg-sidebar">
      <div className="border-b p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              Sessions
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {sessions.length} workspace threads
            </p>
          </div>
          <Button
            variant="default"
            size="icon"
            className="h-8 w-8 rounded-xl shadow-sm"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="h-9 rounded-xl bg-background pl-8 text-xs"
          />
        </div>

        {isCreating && (
          <div className="mb-2 rounded-xl border bg-background p-2 shadow-sm">
            <Input
              placeholder="Session name..."
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateSession();
                if (e.key === "Escape") setIsCreating(false);
              }}
              className="h-8 text-sm"
              autoFocus
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateSession}>
                Create
              </Button>
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-background/70 p-5 text-center text-sm text-muted-foreground">
              {sessions.length === 0 ? "No sessions yet" : "No matching sessions"}
            </div>
          ) : (
            filteredSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session.id)}
                className={`group w-full rounded-xl border px-3 py-3 text-left text-sm transition-all ${
                  selectedSessionId === session.id
                    ? "border-primary/30 bg-primary text-primary-foreground shadow-md"
                    : "border-transparent bg-background/70 text-sidebar-foreground hover:border-border hover:bg-background hover:shadow-sm"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      selectedSessionId === session.id
                        ? "bg-white/10"
                        : "bg-muted"
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 opacity-70" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {session.name}
                      </span>
                      {session.last_run_id && (
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            selectedSessionId === session.id
                              ? "bg-emerald-300"
                              : "bg-success"
                          }`}
                        />
                      )}
                    </div>
                    <p
                      className={`mt-0.5 truncate text-[11px] ${
                        selectedSessionId === session.id
                          ? "text-white/65"
                          : "text-muted-foreground"
                      }`}
                    >
                      Updated {new Date(session.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className={`rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 ${
                      selectedSessionId === session.id
                        ? "hover:bg-white/10"
                        : "hover:bg-destructive/10"
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
