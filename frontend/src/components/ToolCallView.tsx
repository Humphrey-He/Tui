"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Clock, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import type { ToolCall } from "@/types";

interface ToolCallViewProps {
  toolCall: ToolCall;
  onClose: () => void;
}

export function ToolCallView({ toolCall, onClose }: ToolCallViewProps) {
  const getStatusIcon = () => {
    switch (toolCall.status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending_approval":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRiskBadge = () => {
    const variants: Record<string, string> = {
      low: "bg-green-500/10 text-green-600",
      medium: "bg-yellow-500/10 text-yellow-600",
      high: "bg-orange-500/10 text-orange-600",
      critical: "bg-red-500/10 text-red-600",
    };
    return (
      <Badge className={variants[toolCall.risk_level] || "bg-muted"}>
        {toolCall.risk_level}
      </Badge>
    );
  };

  const formatDuration = () => {
    if (!toolCall.started_at) return "-";
    const start = new Date(toolCall.started_at).getTime();
    const end = toolCall.completed_at
      ? new Date(toolCall.completed_at).getTime()
      : Date.now();
    return `${(end - start) / 1000}s`;
  };

  return (
    <div className="p-4 bg-muted/50 border-t">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{toolCall.tool_name}</h3>
          {getStatusIcon()}
          {getRiskBadge()}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Arguments */}
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-sm">Arguments</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <ScrollArea className="h-32">
              <pre className="text-xs bg-background p-2 rounded overflow-auto">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-sm">Result</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {toolCall.error_message ? (
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{toolCall.error_message}</span>
              </div>
            ) : toolCall.result ? (
              <ScrollArea className="h-32">
                <pre className="text-xs bg-background p-2 rounded overflow-auto">
                  {JSON.stringify(toolCall.result, null, 2)}
                </pre>
              </ScrollArea>
            ) : (
              <span className="text-sm text-muted-foreground">
                No result yet
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span>Started: {new Date(toolCall.started_at).toLocaleString()}</span>
        <span>Duration: {formatDuration()}</span>
        {toolCall.required_permission && (
          <span>Permission: {toolCall.required_permission}</span>
        )}
      </div>
    </div>
  );
}
