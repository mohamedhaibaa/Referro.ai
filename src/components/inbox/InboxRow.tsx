import { useNavigate } from "react-router-dom";
import {
  Users,
  Pen,
  Send,
  MessageCircle,
  Briefcase,
  Clock,
  Star,
  Coffee,
  Play,
  Clock3,
  Check,
  MoreHorizontal,
  ExternalLink,
  ArrowRight,
  FileText,
  Archive,
} from "lucide-react";
import { InboxAction, InboxActionType } from "@/types/inbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface InboxRowProps {
  action: InboxAction;
  onMarkDone: (actionId: string) => void;
  onSnooze: (actionId: string) => void;
  compact?: boolean;
}

const iconMap: Record<InboxActionType, React.ElementType> = {
  FIND_CONTACTS: Users,
  GENERATE_OUTREACH: Pen,
  SEND_OUTREACH: Send,
  LOG_REPLY: MessageCircle,
  INTERVIEW_PREP: Briefcase,
  WAITING_NUDGE: Clock,
  RATE_FIT: Star,
  PREP_MEETING: Coffee,
};

const colorMap: Record<InboxActionType, string> = {
  FIND_CONTACTS: "bg-amber-500/20 text-amber-600",
  GENERATE_OUTREACH: "bg-blue-500/20 text-blue-600",
  SEND_OUTREACH: "bg-green-500/20 text-green-600",
  LOG_REPLY: "bg-purple-500/20 text-purple-600",
  INTERVIEW_PREP: "bg-primary/20 text-primary",
  WAITING_NUDGE: "bg-orange-500/20 text-orange-600",
  RATE_FIT: "bg-yellow-500/20 text-yellow-600",
  PREP_MEETING: "bg-teal-500/20 text-teal-600",
};

const InboxRow = ({ action, onMarkDone, onSnooze, compact = false }: InboxRowProps) => {
  const navigate = useNavigate();
  const Icon = iconMap[action.type];

  const handleStart = () => {
    // Navigate to job detail with appropriate section
    const sectionMap: Partial<Record<InboxActionType, string>> = {
      FIND_CONTACTS: "contacts",
      GENERATE_OUTREACH: "outreach",
      SEND_OUTREACH: "outreach",
      INTERVIEW_PREP: "interview",
      PREP_MEETING: "notes",
    };
    const section = sectionMap[action.type] || "";
    navigate(`/job/${action.linkedJobId}${section ? `?section=${section}` : ""}`);
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-4 px-4 py-3 rounded-xl transition-all hover:bg-muted/50",
        compact ? "py-2" : "py-3"
      )}
    >
      {/* Icon indicator */}
      <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", colorMap[action.type])}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium text-foreground truncate", compact ? "text-sm" : "text-base")}>
          {action.title}
        </p>
        {!compact && (
          <p className="text-xs text-muted-foreground mt-0.5">{action.subtitleTag}</p>
        )}
      </div>

      {/* Day progress circle for interview prep */}
      {action.sequenceTotal && action.sequenceCurrent && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <div className="relative w-7 h-7">
            <svg className="w-7 h-7 -rotate-90">
              <circle
                cx="14"
                cy="14"
                r="10"
                className="fill-none stroke-muted stroke-2"
              />
              <circle
                cx="14"
                cy="14"
                r="10"
                className="fill-none stroke-primary stroke-2"
                strokeDasharray={`${(action.sequenceCurrent / action.sequenceTotal) * 62.83} 62.83`}
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="tabular-nums">
            Day {action.sequenceCurrent}/{action.sequenceTotal}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className={cn("flex items-center gap-1 shrink-0", !compact && "opacity-0 group-hover:opacity-100 transition-opacity")}>
        <Button size="sm" onClick={handleStart} className="gap-1.5 h-8">
          <Play className="w-3 h-3" />
          Start
        </Button>

        {!compact && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSnooze(action.id)}>
              <Clock3 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMarkDone(action.id)}>
              <Check className="w-4 h-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleStart}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open job
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Move job to next stage
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <FileText className="w-4 h-4 mr-2" />
                  Add note
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMarkDone(action.id)}>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive item
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
};

export default InboxRow;
