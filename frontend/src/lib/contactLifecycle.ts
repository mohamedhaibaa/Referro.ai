import { OutreachType } from "@/types/job";

export const STATES = {
  NOT_CONTACTED: "not_contacted",
  DRAFTED: "drafted",
  SENT: "sent",
  FOLLOWUP_1_DRAFTED: "followup_1_drafted",
  FOLLOWUP_1_SENT: "followup_1_sent",
  FOLLOWUP_2_DRAFTED: "followup_2_drafted",
  FOLLOWUP_2_SENT: "followup_2_sent",
  REPLIED: "replied",
} as const;

export type LifecycleStatus = typeof STATES[keyof typeof STATES];

export const TIMELINE_STEPS: Array<{ key: string; label: string }> = [
  { key: "not_contacted", label: "Not contacted" },
  { key: "drafted", label: "Drafted" },
  { key: "sent", label: "Sent" },
  { key: "follow_up", label: "Follow-up" },
];

export function timelineIndex(status: string): number {
  if (status === STATES.NOT_CONTACTED) return 0;
  if (status === STATES.DRAFTED) return 1;
  if (status === STATES.SENT) return 2;
  if (
    status === STATES.FOLLOWUP_1_DRAFTED ||
    status === STATES.FOLLOWUP_1_SENT ||
    status === STATES.FOLLOWUP_2_DRAFTED ||
    status === STATES.FOLLOWUP_2_SENT
  ) {
    return 3;
  }
  if (status === STATES.REPLIED) return 3;
  return 0;
}

export function statusLabel(status: string): string {
  switch (status) {
    case STATES.NOT_CONTACTED: return "Not contacted yet";
    case STATES.DRAFTED: return "Draft in progress";
    case STATES.SENT: return "Message sent";
    case STATES.FOLLOWUP_1_DRAFTED: return "Follow-up 1 drafted";
    case STATES.FOLLOWUP_1_SENT: return "Follow-up 1 sent";
    case STATES.FOLLOWUP_2_DRAFTED: return "Follow-up 2 drafted";
    case STATES.FOLLOWUP_2_SENT: return "Follow-up 2 sent";
    case STATES.REPLIED: return "Marked replied";
    default: return status;
  }
}

export function shortStatusBadge(status: string): string {
  switch (status) {
    case STATES.NOT_CONTACTED: return "Not contacted yet";
    case STATES.DRAFTED: return "Draft";
    case STATES.SENT: return "Sent";
    case STATES.FOLLOWUP_1_DRAFTED: return "FU1 draft";
    case STATES.FOLLOWUP_1_SENT: return "FU1 sent";
    case STATES.FOLLOWUP_2_DRAFTED: return "FU2 draft";
    case STATES.FOLLOWUP_2_SENT: return "FU2 sent";
    case STATES.REPLIED: return "Replied";
    default: return "Unknown";
  }
}

/** Returns the OutreachType the user can currently create, or null if
 * no new message should be created in this state. */
export function nextCreatableType(status: string): OutreachType | null {
  if (status === STATES.NOT_CONTACTED) return "initial";
  if (status === STATES.SENT) return "followup_1";
  if (status === STATES.FOLLOWUP_1_SENT) return "followup_2";
  return null;
}

/** Returns the type of the current editable draft (if any). */
export function currentDraftType(status: string): OutreachType | null {
  if (status === STATES.DRAFTED) return "initial";
  if (status === STATES.FOLLOWUP_1_DRAFTED) return "followup_1";
  if (status === STATES.FOLLOWUP_2_DRAFTED) return "followup_2";
  return null;
}

export function canMarkSent(status: string): boolean {
  return status === STATES.DRAFTED
    || status === STATES.FOLLOWUP_1_DRAFTED
    || status === STATES.FOLLOWUP_2_DRAFTED;
}

export function canMarkReplied(status: string): boolean {
  return status === STATES.SENT
    || status === STATES.FOLLOWUP_1_SENT
    || status === STATES.FOLLOWUP_2_SENT;
}

export function isTerminal(status: string): boolean {
  return status === STATES.REPLIED;
}

export function canUndo(status: string): boolean {
  return status !== STATES.NOT_CONTACTED;
}

export function undoLabel(status: string): string {
  switch (status) {
    case STATES.DRAFTED: return "Discard draft";
    case STATES.SENT: return "Unsend";
    case STATES.FOLLOWUP_1_DRAFTED: return "Discard follow-up draft";
    case STATES.FOLLOWUP_1_SENT: return "Unsend follow-up";
    case STATES.FOLLOWUP_2_DRAFTED: return "Discard follow-up draft";
    case STATES.FOLLOWUP_2_SENT: return "Unsend follow-up";
    case STATES.REPLIED: return "Undo mark replied";
    default: return "Undo";
  }
}
