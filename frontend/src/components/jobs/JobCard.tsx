import { MouseEvent } from "react";
import { Link } from "react-router-dom";
import { MoreVertical, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Job } from "@/types/job";
import { getStagePill, TONE_CLASSES } from "@/lib/jobStagePill";

interface JobCardProps {
  job: Job;
  archived?: boolean;
  onArchive?: (job: Job) => void;
  onRestore?: (job: Job) => void;
}

const JobCard = ({ job, archived = false, onArchive, onRestore }: JobCardProps) => {
  const pill = getStagePill(job.status, job.contactStatuses);
  const isParsing = !job.title || job.title === "Untitled";
  const monogram = (job.company?.[0] ?? job.title?.[0] ?? "?").toUpperCase();

  const stopNav = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link
      to={`/jobs/${job.id}/room`}
      className="group block rounded-2xl border border-border bg-card p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted flex items-center justify-center text-lg font-semibold text-foreground shrink-0">
          {job.companyLogoUrl ? (
            <img src={job.companyLogoUrl} alt={job.company} className="w-full h-full object-cover" />
          ) : (
            monogram
          )}
        </div>

        {((!archived && onArchive) || (archived && onRestore)) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={stopNav}>
              <button
                className="p-1.5 -m-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="Job actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={stopNav}>
              {archived && onRestore ? (
                <DropdownMenuItem onSelect={() => onRestore(job)}>
                  Restore
                </DropdownMenuItem>
              ) : onArchive ? (
                <DropdownMenuItem
                  onSelect={() => onArchive(job)}
                  className="text-destructive focus:text-destructive"
                >
                  Archive
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="mt-4 space-y-1">
        {isParsing ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Parsing…</span>
          </div>
        ) : (
          <h3 className="text-base font-semibold text-foreground line-clamp-2">
            {job.title}
          </h3>
        )}
        <p className="text-sm text-muted-foreground line-clamp-1">
          {job.company || "—"}
        </p>
      </div>

      <div className="mt-4">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${TONE_CLASSES[pill.tone]}`}>
          {pill.label}
        </span>
      </div>
    </Link>
  );
};

export default JobCard;
