import { JobStatus } from "@/types/job";

// TODO (Stage 6): derive from per-contact lifecycle once the 11-state model exists;
// today this maps the job's manual status field only.

export type StageTone =
  | "neutral"
  | "early-active"
  | "mid-active"
  | "late-active"
  | "landed"
  | "closed";

export interface StagePill {
  label: string;
  tone: StageTone;
}

const MAP: Record<JobStatus, StagePill> = {
  "Interested":       { label: "Ready to reach out", tone: "neutral" },
  "Outreach Ready":   { label: "Ready to reach out", tone: "neutral" },
  "Outreach Sent":    { label: "Outreach Sent",      tone: "early-active" },
  "Replied":          { label: "In Conversation",    tone: "early-active" },
  "Meeting Booked":   { label: "Coffee Chat",        tone: "mid-active" },
  "Interviewing":     { label: "Interview Stage",    tone: "late-active" },
  "Offer":            { label: "Landed 🎉",          tone: "landed" },
  "Closed":           { label: "Closed",             tone: "closed" },
};

export function getStagePill(status: JobStatus): StagePill {
  return MAP[status] ?? MAP["Interested"];
}

export const TONE_CLASSES: Record<StageTone, string> = {
  "neutral":       "bg-muted text-muted-foreground",
  "early-active":  "bg-primary/10 text-primary",
  "mid-active":    "bg-primary/20 text-primary",
  "late-active":   "bg-primary/25 text-primary",
  "landed":        "bg-[hsl(var(--card-yellow))] text-foreground",
  "closed":        "bg-muted text-muted-foreground opacity-70",
};

const STAGE_SORT_ORDER: JobStatus[] = [
  "Interested",
  "Outreach Ready",
  "Outreach Sent",
  "Replied",
  "Meeting Booked",
  "Interviewing",
  "Offer",
  "Closed",
];

export function stageSortIndex(status: JobStatus): number {
  const i = STAGE_SORT_ORDER.indexOf(status);
  return i === -1 ? STAGE_SORT_ORDER.length : i;
}
