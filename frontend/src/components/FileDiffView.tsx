"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileCode2 } from "lucide-react";
import type { FileDiff } from "@/types";

interface FileDiffViewProps {
  diff: FileDiff;
  onClose: () => void;
}

export function FileDiffView({ diff, onClose }: FileDiffViewProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[82vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <FileCode2 className="h-4 w-4" />
              </div>
              <DialogTitle className="truncate text-base">
                {diff.file_path}
              </DialogTitle>
            </div>
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
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-[#0f172a]">
          <pre className="overflow-auto p-4 font-mono text-xs leading-6 text-slate-100">
            {diff.diff_content}
          </pre>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
