"use client";

import { useState, useMemo } from "react";
import { useConsoleStore } from "@/stores/consoleStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bug,
  Info,
  AlertTriangle,
  AlertCircle,
  Search,
  X,
} from "lucide-react";
import type { LogLevel, LogEntry } from "@/types";

const LOG_LEVEL_CONFIG: Record<LogLevel, { icon: React.ReactNode; color: string; label: string }> = {
  debug: { icon: <Bug className="h-3 w-3" />, color: "text-muted-foreground", label: "DEBUG" },
  info: { icon: <Info className="h-3 w-3" />, color: "text-blue-500", label: "INFO" },
  warn: { icon: <AlertTriangle className="h-3 w-3" />, color: "text-yellow-500", label: "WARN" },
  error: { icon: <AlertCircle className="h-3 w-3" />, color: "text-red-500", label: "ERROR" },
};

const LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

export function LogsPanel() {
  const { logs, logFilter, setLogFilter, currentRun } = useConsoleStore();
  const [autoScroll, setAutoScroll] = useState(true);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Level filter
      if (logFilter.level && log.level !== logFilter.level) {
        return false;
      }
      // Keyword filter
      if (logFilter.keyword && !log.message.toLowerCase().includes(logFilter.keyword.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [logs, logFilter]);

  const handleLevelToggle = (level: LogLevel) => {
    if (logFilter.level === level) {
      setLogFilter({ level: null });
    } else {
      setLogFilter({ level });
    }
  };

  const handleClearKeyword = () => {
    setLogFilter({ keyword: "" });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Logs</h2>
          {currentRun && (
            <Badge
              variant={
                currentRun.status === "running"
                  ? "default"
                  : currentRun.status === "completed"
                  ? "secondary"
                  : "outline"
              }
              className="text-xs"
            >
              {currentRun.status}
            </Badge>
          )}
          {filteredLogs.length !== logs.length && (
            <Badge variant="outline" className="text-xs">
              {filteredLogs.length}/{logs.length}
            </Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
        {/* Level filters */}
        <div className="flex items-center gap-1">
          {LEVELS.map((level) => {
            const config = LOG_LEVEL_CONFIG[level];
            const isActive = logFilter.level === level;
            return (
              <Button
                key={level}
                variant="ghost"
                size="sm"
                className={`h-7 px-2 ${config.color} ${isActive ? "bg-muted" : ""}`}
                onClick={() => handleLevelToggle(level)}
              >
                {config.icon}
                <span className="ml-1 text-xs">{config.label}</span>
              </Button>
            );
          })}
        </div>

        {/* Keyword search */}
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={logFilter.keyword}
            onChange={(e) => setLogFilter({ keyword: e.target.value })}
            className="h-7 pl-7 pr-7 text-xs"
          />
          {logFilter.keyword && (
            <button
              onClick={handleClearKeyword}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Auto-scroll toggle */}
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 text-xs ${autoScroll ? "bg-muted" : ""}`}
          onClick={() => setAutoScroll(!autoScroll)}
        >
          Auto-scroll
        </Button>
      </div>

      {/* Log entries */}
      <ScrollArea className="flex-1">
        <div className="p-2 font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              {logs.length === 0 ? "No logs yet" : "No matching logs"}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log) => (
                <LogEntryRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function LogEntryRow({ log }: { log: LogEntry }) {
  const config = LOG_LEVEL_CONFIG[log.level];

  return (
    <div className="flex items-start gap-2 rounded-lg px-2 py-1 hover:bg-muted/55">
      <span className="text-muted-foreground shrink-0">
        {new Date(log.created_at).toLocaleTimeString()}
      </span>
      <span className={`shrink-0 ${config.color}`}>
        {config.icon}
      </span>
      <span className={`shrink-0 text-xs ${config.color}`}>
        [{config.label}]
      </span>
      <span className="flex-1 break-all">{log.message}</span>
    </div>
  );
}
