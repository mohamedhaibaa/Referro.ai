import { JobStatus } from "@/types/job";

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

const LEGACY_MAP: Record<JobStatus, StagePill> = {
  "Interested":       { label: "Ready to reach out", tone: "neutral" },
  "Outreach Ready":   { label: "Ready to reach out", tone: "neutral" },
  "Outreach Sent":    { label: "Outreach Sent",      tone: "early-active" },
  "Replied":          { label: "In Conversation",    tone: "early-active" },
  "Meeting Booked":   { label: "Coffee Chat",        tone: "mid-active" },
  "Interviewing":     { label: "Interview Stage",    tone: "late-active" },
  "Offer":            { label: "Landed 🎉",          tone: "landed" },
  "Closed":           { label: "Closed",             tone: "closed" },
};

function isOutcomeStatus(s: string): boolean {
  return s.startsWith("outcome_");
}

/** Derive the job-level pill from the per-contact lifecycle statuses.
 * Falls back to the legacy Job.status mapping if contactStatuses is absent or empty.
 *
 * Priority:
 *   1. Any outcome_offer → Landed 🎉
 *   2. Most-progressed active (non-outcome) contact drives the pill
 *   3. All contacts in some outcome (none offer) → Closed
 *   4. Else → Ready to reach out
 */
export function getStagePill(status: JobStatus, contactStatuses?: string[]): StagePill {
  const arr = contactStatuses ?? [];
  if (arr.length === 0) return LEGACY_MAP[status] ?? LEGACY_MAP["Interested"];

  // 1. Any offer wins.
  if (arr.includes("outcome_offer")) {
    return { label: "Landed 🎉", tone: "landed" };
  }

  // 2. Consider only contacts still in an active (non-outcome) state.
  const active = arr.filter((s) => !isOutcomeStatus(s));

  if (active.length > 0) {
    const hasAny = (...prefixes: string[]) =>
      active.some((st) => prefixes.some((p) => st === p || st.startsWith(p)));

    if (hasAny("interview_scheduled", "interview_completed")) return { label: "Interview Stage", tone: "late-active" };
    if (hasAny("coffee_chat_scheduled", "coffee_chat_completed")) return { label: "Coffee Chat", tone: "mid-active" };
    if (active.includes("replied")) return { label: "In Conversation", tone: "early-active" };
    if (hasAny("sent", "followup_1_sent", "followup_2_sent")) return { label: "Outreach Sent", tone: "early-active" };
    if (hasAny("drafted", "followup_1_drafted", "followup_2_drafted")) return { label: "Drafting", tone: "neutral" };
    if (active.includes("connected")) return { label: "Connection sent", tone: "neutral" };  // REF-28

    return { label: "Ready to reach out", tone: "neutral" };
  }

  // 3. All contacts are terminal outcomes (and no offer, from step 1). Job is closed.
  return { label: "Closed", tone: "closed" };
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
