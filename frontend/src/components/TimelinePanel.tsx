"use client";

import { useConsoleStore } from "@/stores/consoleStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Wrench,
  Shield,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import type { AgentStep } from "@/types";

export function TimelinePanel() {
  const { steps, currentRun } = useConsoleStore();

  const getStepIcon = (step: AgentStep) => {
    switch (step.step_type) {
      case "message":
        return <MessageSquare className="h-4 w-4" />;
      case "tool_call":
        return <Wrench className="h-4 w-4" />;
      case "approval":
        return <Shield className="h-4 w-4" />;
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-500";
      case "failed":
        return "text-red-500";
      case "started":
        return "text-blue-500";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold">Timeline</h2>
          {currentRun && (
            <Badge
              variant={
                currentRun.status === "running"
                  ? "default"
                  : currentRun.status === "completed"
                  ? "secondary"
                  : "outline"
              }
            >
              {currentRun.status}
            </Badge>
          )}
        </div>
        {currentRun && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Model: {currentRun.model}</span>
            <span>Tokens: {currentRun.total_tokens}</span>
            <span>Cost: ${currentRun.estimated_cost.toFixed(4)}</span>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {steps.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No steps yet. Start a run to see the timeline.
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

              {/* Steps */}
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.id} className="relative flex gap-4 pl-10">
                    {/* Icon */}
                    <div
                      className={`absolute left-2 w-5 h-5 rounded-full bg-background border-2 ${getStatusColor(
                        step.status
                      )} flex items-center justify-center`}
                    >
                      {getStepIcon(step)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">
                          {step.step_type.replace(/_/g, " ")}
                        </span>
                        {step.status === "completed" && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        {step.status === "failed" && (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(step.created_at).toLocaleTimeString()}
                        {step.completed_at &&
                          ` - ${new Date(step.completed_at).toLocaleTimeString()}`}
                      </p>
                    </div>

                    {/* Step number */}
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
