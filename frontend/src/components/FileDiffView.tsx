"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FileDiff } from "@/types";

interface FileDiffViewProps {
  diff: FileDiff;
  onClose: () => void;
}

export function FileDiffView({ diff, onClose }: FileDiffViewProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{diff.file_path}</DialogTitle>
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

        <div className="flex-1 overflow-auto">
          <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto">
            {diff.diff_content}
          </pre>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
