import { useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { Job, JobStatus } from "@/types/job";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import KanbanCard from "./KanbanCard";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  status: JobStatus;
  jobs: Job[];
  wipLimit?: number;
  onWipLimitChange?: (status: JobStatus, limit: number | undefined) => void;
  onMoveJob?: (jobId: string, newStatus: JobStatus) => void;
  onDragStart?: (e: React.DragEvent, jobId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, status: JobStatus) => void;
  isHidden?: boolean;
}

const statusColors: Record<JobStatus, string> = {
  Interested: "bg-slate-500",
  "Outreach Ready": "bg-amber-500",
  "Outreach Sent": "bg-orange-500",
  Replied: "bg-emerald-500",
  "Meeting Booked": "bg-cyan-500",
  Interviewing: "bg-blue-500",
  Offer: "bg-purple-500",
  Closed: "bg-gray-500",
};

const KanbanColumn = ({
  status,
  jobs,
  wipLimit,
  onWipLimitChange,
  onMoveJob,
  onDragStart,
  onDragOver,
  onDrop,
  isHidden,
}: KanbanColumnProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showWipDialog, setShowWipDialog] = useState(false);
  const [tempWipLimit, setTempWipLimit] = useState<string>(
    wipLimit?.toString() || ""
  );

  const isOverLimit = wipLimit !== undefined && jobs.length > wipLimit;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
    onDragOver?.(e);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onDrop?.(e, status);
  };

  const handleSaveWipLimit = () => {
    const limit = tempWipLimit ? parseInt(tempWipLimit, 10) : undefined;
    onWipLimitChange?.(status, limit);
    setShowWipDialog(false);
  };

  if (isHidden) return null;

  return (
    <>
      <div
        className={cn(
          "flex flex-col w-72 shrink-0 bg-muted/30 rounded-xl transition-all duration-200",
          isDragOver && "ring-2 ring-primary/50 bg-primary/5"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Column Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", statusColors[status])} />
            <h3 className="font-medium text-sm text-foreground">{status}</h3>
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded-full",
                isOverLimit
                  ? "bg-red-100 text-red-600"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {jobs.length}
              {wipLimit !== undefined && `/${wipLimit}`}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowWipDialog(true)}>
                Set list limit
              </DropdownMenuItem>
              {wipLimit !== undefined && (
                <DropdownMenuItem
                  onClick={() => onWipLimitChange?.(status, undefined)}
                >
                  Remove limit
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Cards */}
        <ScrollArea className="flex-1 p-2">
          <div className="flex flex-col gap-2">
            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-xs text-muted-foreground mb-2">
                  No jobs in this stage
                </p>
              </div>
            ) : (
              jobs.map((job) => (
                <KanbanCard
                  key={job.id}
                  job={job}
                  onMoveToColumn={onMoveJob}
                  onDragStart={onDragStart}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* WIP Limit Dialog */}
      <Dialog open={showWipDialog} onOpenChange={setShowWipDialog}>
        <DialogContent className="sm:max-w-[300px]">
          <DialogHeader>
            <DialogTitle>Set List Limit</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="wip-limit">Maximum cards in "{status}"</Label>
            <Input
              id="wip-limit"
              type="number"
              min="1"
              placeholder="e.g., 10"
              value={tempWipLimit}
              onChange={(e) => setTempWipLimit(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWipDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveWipLimit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default KanbanColumn;
