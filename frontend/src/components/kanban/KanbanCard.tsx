import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, ExternalLink, Zap, Building2 } from "lucide-react";
import { Job, getNextStepLabel } from "@/types/job";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface KanbanCardProps {
  job: Job;
  onMoveToColumn?: (jobId: string, newStatus: Job["status"]) => void;
  onDragStart?: (e: React.DragEvent, jobId: string) => void;
}


const KanbanCard = ({ job, onMoveToColumn, onDragStart }: KanbanCardProps) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const nextStep = getNextStepLabel(job);

  const handleCardClick = () => {
    navigate(`/job/${job.id}`);
  };

  const handleNextStep = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/job/${job.id}`);
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, job.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
      className="group bg-card border border-border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5"
    >
      {/* Header: Title + Actions */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-foreground text-sm leading-tight line-clamp-2">
          {job.title}
        </h4>
        <div
          className={cn(
            "flex items-center gap-1 transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/job/${job.id}`);
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => navigate(`/job/${job.id}`)}>
                Open Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onMoveToColumn?.(job.id, "Interested")}
              >
                Move to Interested
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onMoveToColumn?.(job.id, "Outreach Ready")}
              >
                Move to Outreach Ready
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onMoveToColumn?.(job.id, "Outreach Sent")}
              >
                Move to Outreach Sent
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onMoveToColumn?.(job.id, "Replied")}
              >
                Move to Replied
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onMoveToColumn?.(job.id, "Meeting Booked")}
              >
                Move to Meeting Booked
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onMoveToColumn?.(job.id, "Interviewing")}
              >
                Move to Interviewing
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onMoveToColumn?.(job.id, "Offer")}
              >
                Move to Offer
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onMoveToColumn?.(job.id, "Closed")}
              >
                Move to Closed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Company */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-5 rounded bg-muted flex items-center justify-center shrink-0">
          {job.companyLogoUrl ? (
            <img
              src={job.companyLogoUrl}
              alt={job.company}
              className="h-4 w-4 rounded"
            />
          ) : (
            <Building2 className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
        <span className="text-xs text-muted-foreground truncate">
          {job.company}
        </span>
      </div>

      {/* Parsed metadata badges */}
      {(job.workMode || job.fitScore) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {job.workMode && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 capitalize">
              {job.workMode}
            </Badge>
          )}
          {job.fitScore && (
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-5 capitalize ${
                job.fitScore === "high"
                  ? "border-green-500 text-green-600 bg-green-50"
                  : job.fitScore === "medium"
                  ? "border-yellow-500 text-yellow-600 bg-yellow-50"
                  : "border-red-400 text-red-500 bg-red-50"
              }`}
            >
              {job.fitScore} fit
            </Badge>
          )}
        </div>
      )}

      {/* Custom Tags */}
      {job.tags && job.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {job.tags.slice(0, 2).map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-5 bg-primary/5 text-primary border-primary/20"
            >
              {tag}
            </Badge>
          ))}
          {job.tags.length > 2 && (
            <span className="text-[10px] text-muted-foreground">
              +{job.tags.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span>Progress</span>
          <span>{job.progress}%</span>
        </div>
        <Progress value={job.progress} className="h-1" />
      </div>

      {/* Next Step Button */}
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "w-full h-7 text-xs gap-1.5 transition-all duration-200",
          isHovered
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "hover:bg-muted"
        )}
        onClick={handleNextStep}
      >
        <Zap className="h-3 w-3" />
        {nextStep}
      </Button>
    </div>
  );
};

export default KanbanCard;
