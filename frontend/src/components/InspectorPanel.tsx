"use client";

import { useState } from "react";
import { useConsoleStore } from "@/stores/consoleStore";
import { controlSocketService } from "@/lib/realtime/controlSocket";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ToolCallView } from "@/components/ToolCallView";
import { FileDiffView } from "@/components/FileDiffView";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Edit3,
  FileCode2,
  Wrench,
} from "lucide-react";
import type { ApprovalRequest, FileDiff, ToolCall } from "@/types";

export function InspectorPanel() {
  const [selectedDiff, setSelectedDiff] = useState<FileDiff | null>(null);
  const {
    selectedApprovalId,
    setSelectedApproval,
    approvals,
    toolCalls,
    selectedToolCallId,
    setSelectedToolCall,
    fileDiffs,
  } = useConsoleStore();

  const selectedToolCall = toolCalls.find(
    (tc) => tc.id === selectedToolCallId
  );
  const selectedApproval = approvals.find(
    (a) => a.id === selectedApprovalId
  );
  const pendingApprovals = approvals.filter(
    (a) => a.status === "pending"
  );

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case "critical":
      case "high":
        return <ShieldAlert className="h-4 w-4 text-destructive" />;
      case "medium":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="border-b p-3">
        <h2 className="text-sm font-semibold tracking-tight text-sidebar-foreground">
          Inspector
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Tool calls, approvals, and generated changes
        </p>
      </div>

      <Tabs defaultValue="tool-calls" className="flex-1 flex flex-col">
        <TabsList className="h-auto w-full justify-start rounded-none border-b bg-muted/40 p-1">
          <TabsTrigger
            value="tool-calls"
            className="h-8 rounded-lg px-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Tool Calls
            {toolCalls.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {toolCalls.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="approvals"
            className="h-8 rounded-lg px-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Approvals
            {pendingApprovals.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingApprovals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="h-8 rounded-lg px-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Files
            {fileDiffs.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {fileDiffs.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tool-calls" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {toolCalls.length === 0 ? (
                <EmptyInspectorState
                  icon={<Wrench className="h-5 w-5" />}
                  title="No tool calls"
                  description="Tool activity will appear here as the agent works."
                />
              ) : (
                toolCalls.map((toolCall) => (
                  <ToolCallCard
                    key={toolCall.id}
                    toolCall={toolCall}
                    isSelected={selectedToolCallId === toolCall.id}
                    onSelect={() => setSelectedToolCall(toolCall.id)}
                    getRiskIcon={getRiskIcon}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="approvals" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {pendingApprovals.length === 0 ? (
                <EmptyInspectorState
                  icon={<ShieldAlert className="h-5 w-5" />}
                  title="No pending approvals"
                  description="High-risk actions will pause here for review."
                />
              ) : (
                pendingApprovals.map((approval) => (
                  <ApprovalCard
                    key={approval.id}
                    approval={approval}
                    isSelected={selectedApprovalId === approval.id}
                    onSelect={() => setSelectedApproval(approval.id)}
                    getRiskIcon={getRiskIcon}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="files" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {fileDiffs.length === 0 ? (
                <EmptyInspectorState
                  icon={<FileCode2 className="h-5 w-5" />}
                  title="No file changes"
                  description="Generated diffs and artifacts will be listed here."
                />
              ) : (
                fileDiffs.map((diff) => (
                  <FileDiffCard
                    key={diff.id}
                    diff={diff}
                    onClick={() => setSelectedDiff(diff)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Detail View */}
      {(selectedToolCall || selectedApproval) && (
        <div className="border-t">
          {selectedToolCall && (
            <ToolCallView
              toolCall={selectedToolCall}
              onClose={() => setSelectedToolCall(null)}
            />
          )}
          {selectedApproval && (
            <ApprovalDetailView
              approval={selectedApproval}
              onClose={() => setSelectedApproval(null)}
              getRiskIcon={getRiskIcon}
            />
          )}
        </div>
      )}
      {selectedDiff && (
        <FileDiffView diff={selectedDiff} onClose={() => setSelectedDiff(null)} />
      )}
    </div>
  );
}

function ToolCallCard({
  toolCall,
  isSelected,
  onSelect,
  getRiskIcon,
}: {
  toolCall: ToolCall;
  isSelected: boolean;
  onSelect: () => void;
  getRiskIcon: (risk: string) => React.ReactNode;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left shadow-sm transition-all ${
        isSelected
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-background/80 hover:border-primary/20 hover:bg-background"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {getRiskIcon(toolCall.risk_level)}
          <span className="font-medium text-sm">{toolCall.tool_name}</span>
        </div>
        <StatusBadge status={toolCall.status} />
      </div>
      <p className="truncate font-mono text-[11px] text-muted-foreground">
        {JSON.stringify(toolCall.arguments)}
      </p>
    </button>
  );
}

function ApprovalCard({
  approval,
  isSelected,
  onSelect,
  getRiskIcon,
}: {
  approval: ApprovalRequest;
  isSelected: boolean;
  onSelect: () => void;
  getRiskIcon: (risk: string) => React.ReactNode;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left shadow-sm transition-all ${
        isSelected
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-background/80 hover:border-destructive/20 hover:bg-background"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <span className="font-medium text-sm">Approval Required</span>
        </div>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-xs text-muted-foreground">
        {approval.requested_action}
      </p>
    </button>
  );
}

function FileDiffCard({
  diff,
  onClick,
}: {
  diff: { id: string; file_path: string; change_type: string };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-border bg-background/80 p-3 text-left shadow-sm transition-all hover:border-primary/20 hover:bg-background"
    >
      <div className="flex items-center justify-between">
        <span className="truncate text-sm font-medium">{diff.file_path}</span>
        <Badge
          variant={
            diff.change_type === "deleted"
              ? "destructive"
              : diff.change_type === "created"
              ? "default"
              : "secondary"
          }
        >
          {diff.change_type}
        </Badge>
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    completed: "bg-green-500/10 text-green-600",
    failed: "bg-red-500/10 text-red-600",
    pending_approval: "bg-yellow-500/10 text-yellow-600",
    running: "bg-blue-500/10 text-blue-600",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs ${
        variants[status] || "bg-muted"
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function EmptyInspectorState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-background/70 p-5 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="text-sm font-medium">{title}</div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function ApprovalDetailView({
  approval,
  onClose,
  getRiskIcon,
}: {
  approval: ApprovalRequest;
  onClose: () => void;
  getRiskIcon: (risk: string) => React.ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedArgs, setEditedArgs] = useState(JSON.stringify(approval.original_args, null, 2));
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      controlSocketService.approveToolCall(approval.id, reason || undefined);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      controlSocketService.rejectToolCall(approval.id, reason || undefined);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAndApprove = async () => {
    setIsSubmitting(true);
    setJsonError(null);
    try {
      const parsedArgs = JSON.parse(editedArgs);
      controlSocketService.editToolCall(approval.id, parsedArgs, reason || undefined);
      onClose();
    } catch (error) {
      console.error("Invalid JSON:", error);
      setJsonError("Arguments must be valid JSON before approval.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-t bg-muted/30">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold">Approval Required</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Action Description */}
        <div className="space-y-2 rounded-xl border bg-background p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{approval.requested_action}</span>
            {getRiskIcon("high")}
          </div>
          <p className="text-xs text-muted-foreground">
            This action requires your approval before it can be executed.
          </p>
        </div>

        {/* Arguments */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Arguments</label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="h-7 text-xs"
            >
              <Edit3 className="h-3 w-3 mr-1" />
              {isEditing ? "Cancel" : "Edit"}
            </Button>
          </div>

          {isEditing ? (
            <textarea
              value={editedArgs}
              onChange={(e) => setEditedArgs(e.target.value)}
              className="h-32 w-full resize-none rounded-lg border bg-background p-2 font-mono text-xs outline-none focus:ring-2 focus:ring-primary"
              placeholder="Edit arguments as JSON..."
            />
          ) : (
            <pre className="max-h-40 overflow-auto rounded-lg border bg-background p-3 text-xs">
              {JSON.stringify(approval.original_args, null, 2)}
            </pre>
          )}
          {jsonError && (
            <p className="text-xs text-destructive">{jsonError}</p>
          )}
        </div>

        {/* Reason */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Reason (optional)</label>
          <Input
            placeholder="Add a reason for your decision..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {isEditing ? (
            <>
              <Button
                size="sm"
                onClick={handleEditAndApprove}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Edit & Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleReject}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <XCircle className="h-4 w-4 mr-1" />
                )}
                Reject
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
