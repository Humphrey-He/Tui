"use client";

import { useConsoleStore } from "@/stores/consoleStore";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToolCallView } from "@/components/ToolCallView";
import { FileDiffView } from "@/components/FileDiffView";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import type { ApprovalRequest, ToolCall } from "@/types";

export function InspectorPanel() {
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
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <h2 className="text-sm font-semibold">Inspector</h2>
      </div>

      <Tabs defaultValue="tool-calls" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          <TabsTrigger
            value="tool-calls"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
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
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
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
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
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
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No tool calls yet
                </div>
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
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No pending approvals
                </div>
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
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No file changes yet
                </div>
              ) : (
                fileDiffs.map((diff) => (
                  <FileDiffCard
                    key={diff.id}
                    diff={diff}
                    onClick={() => {}}
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
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {getRiskIcon(toolCall.risk_level)}
          <span className="font-medium text-sm">{toolCall.tool_name}</span>
        </div>
        <StatusBadge status={toolCall.status} />
      </div>
      <p className="text-xs text-muted-foreground truncate">
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
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted"
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
      className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{diff.file_path}</span>
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

function ApprovalDetailView({
  approval,
  onClose,
  getRiskIcon,
}: {
  approval: ApprovalRequest;
  onClose: () => void;
  getRiskIcon: (risk: string) => React.ReactNode;
}) {
  const { controlSocketService } = require("@/lib/realtime/controlSocket");

  const handleApprove = () => {
    controlSocketService.approveToolCall(approval.id);
    onClose();
  };

  const handleReject = () => {
    controlSocketService.rejectToolCall(approval.id);
    onClose();
  };

  return (
    <div className="p-4 bg-muted/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">Approval Request</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Action</p>
          <p className="text-sm font-medium">{approval.requested_action}</p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Arguments</p>
          <pre className="text-xs bg-background p-2 rounded mt-1 overflow-auto">
            {JSON.stringify(approval.original_args, null, 2)}
          </pre>
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleApprove}>
            <CheckCircle className="h-4 w-4 mr-1" />
            Approve
          </Button>
          <Button size="sm" variant="destructive" onClick={handleReject}>
            <XCircle className="h-4 w-4 mr-1" />
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}
