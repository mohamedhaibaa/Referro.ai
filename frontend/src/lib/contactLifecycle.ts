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
  COFFEE_CHAT_SCHEDULED: "coffee_chat_scheduled",
  COFFEE_CHAT_COMPLETED: "coffee_chat_completed",
  INTERVIEW_SCHEDULED: "interview_scheduled",
  INTERVIEW_COMPLETED: "interview_completed",
  OUTCOME_OFFER: "outcome_offer",
  OUTCOME_REJECTED: "outcome_rejected",
  OUTCOME_WITHDREW: "outcome_withdrew",
  OUTCOME_NOT_RIGHT_PERSON: "outcome_not_right_person",
  OUTCOME_NOT_A_FIT: "outcome_not_a_fit",
  OUTCOME_LOST_TOUCH: "outcome_lost_touch",
  OUTCOME_CANCELLED: "outcome_cancelled",
  OUTCOME_COMPANY_CANCELLED: "outcome_company_cancelled",
} as const;

export type LifecycleStatus = typeof STATES[keyof typeof STATES];

export const OUTCOMES = {
  OFFER: "offer",
  REJECTED: "rejected",
  WITHDREW: "withdrew",
  NOT_RIGHT_PERSON: "not_right_person",
  NOT_A_FIT: "not_a_fit",
  LOST_TOUCH: "lost_touch",
  CANCELLED: "cancelled",
  COMPANY_CANCELLED: "company_cancelled",
} as const;

export type OutcomeValue = typeof OUTCOMES[keyof typeof OUTCOMES];

const OUTREACH_STATES = new Set<string>([
  STATES.DRAFTED, STATES.SENT,
  STATES.FOLLOWUP_1_DRAFTED, STATES.FOLLOWUP_1_SENT,
  STATES.FOLLOWUP_2_DRAFTED, STATES.FOLLOWUP_2_SENT,
]);

const MEETING_STATES = new Set<string>([
  STATES.COFFEE_CHAT_SCHEDULED, STATES.COFFEE_CHAT_COMPLETED,
  STATES.INTERVIEW_SCHEDULED, STATES.INTERVIEW_COMPLETED,
]);

const OUTCOME_STATES = new Set<string>([
  STATES.OUTCOME_OFFER,
  STATES.OUTCOME_REJECTED,
  STATES.OUTCOME_WITHDREW,
  STATES.OUTCOME_NOT_RIGHT_PERSON,
  STATES.OUTCOME_NOT_A_FIT,
  STATES.OUTCOME_LOST_TOUCH,
  STATES.OUTCOME_CANCELLED,
  STATES.OUTCOME_COMPANY_CANCELLED,
]);

const POST_REPLY_STATES = new Set<string>([
  STATES.REPLIED,
  ...MEETING_STATES, ...OUTCOME_STATES,
]);

export const TIMELINE_STEPS: Array<{ key: string; label: string }> = [
  { key: "not_contacted", label: "Not contacted" },
  { key: "outreach", label: "Outreach" },
  { key: "replied", label: "Replied" },
  { key: "meeting", label: "Meeting" },
  { key: "outcome", label: "Outcome" },
];

export function timelineIndex(status: string): number {
  if (status === STATES.NOT_CONTACTED) return 0;
  if (OUTREACH_STATES.has(status)) return 1;
  if (status === STATES.REPLIED) return 2;
  if (MEETING_STATES.has(status)) return 3;
  if (OUTCOME_STATES.has(status)) return 4;
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
    case STATES.REPLIED: return "They replied";
    case STATES.COFFEE_CHAT_SCHEDULED: return "Coffee chat scheduled";
    case STATES.COFFEE_CHAT_COMPLETED: return "Coffee chat completed";
    case STATES.INTERVIEW_SCHEDULED: return "Interview scheduled";
    case STATES.INTERVIEW_COMPLETED: return "Interview completed";
    case STATES.OUTCOME_OFFER: return "Landed the offer 🎉";
    case STATES.OUTCOME_REJECTED: return "Didn't land (rejected)";
    case STATES.OUTCOME_WITHDREW: return "Withdrew";
    case STATES.OUTCOME_NOT_RIGHT_PERSON: return "Not the right person";
    case STATES.OUTCOME_NOT_A_FIT: return "Not a fit";
    case STATES.OUTCOME_LOST_TOUCH: return "Lost touch";
    case STATES.OUTCOME_CANCELLED: return "Cancelled";
    case STATES.OUTCOME_COMPANY_CANCELLED: return "Company cancelled";
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
    case STATES.COFFEE_CHAT_SCHEDULED: return "Coffee chat";
    case STATES.COFFEE_CHAT_COMPLETED: return "Chat done";
    case STATES.INTERVIEW_SCHEDULED: return "Interview";
    case STATES.INTERVIEW_COMPLETED: return "Interview done";
    case STATES.OUTCOME_OFFER: return "Landed 🎉";
    case STATES.OUTCOME_REJECTED: return "Rejected";
    case STATES.OUTCOME_WITHDREW: return "Withdrew";
    case STATES.OUTCOME_NOT_RIGHT_PERSON: return "Not right person";
    case STATES.OUTCOME_NOT_A_FIT: return "Not a fit";
    case STATES.OUTCOME_LOST_TOUCH: return "Lost touch";
    case STATES.OUTCOME_CANCELLED: return "Cancelled";
    case STATES.OUTCOME_COMPANY_CANCELLED: return "Company cancelled";
    default: return "Unknown";
  }
}

export function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case OUTCOMES.OFFER: return "Got the offer 🎉";
    case OUTCOMES.REJECTED: return "Rejected";
    case OUTCOMES.WITHDREW: return "I withdrew";
    case OUTCOMES.NOT_RIGHT_PERSON: return "Not the right person";
    case OUTCOMES.NOT_A_FIT: return "Not a fit";
    case OUTCOMES.LOST_TOUCH: return "Lost touch";
    case OUTCOMES.CANCELLED: return "Cancelled";
    case OUTCOMES.COMPANY_CANCELLED: return "Company cancelled";
    default: return outcome;
  }
}

/** Valid outcomes a user can record from a given state. */
export function outcomeOptionsForState(status: string): string[] {
  switch (status) {
    case STATES.REPLIED:
      return [OUTCOMES.WITHDREW, OUTCOMES.NOT_RIGHT_PERSON, OUTCOMES.LOST_TOUCH];
    case STATES.COFFEE_CHAT_SCHEDULED:
      return [OUTCOMES.WITHDREW, OUTCOMES.CANCELLED, OUTCOMES.LOST_TOUCH];
    case STATES.COFFEE_CHAT_COMPLETED:
      return [OUTCOMES.NOT_A_FIT, OUTCOMES.LOST_TOUCH, OUTCOMES.WITHDREW];
    case STATES.INTERVIEW_SCHEDULED:
      return [OUTCOMES.WITHDREW, OUTCOMES.COMPANY_CANCELLED, OUTCOMES.LOST_TOUCH];
    case STATES.INTERVIEW_COMPLETED:
      return [OUTCOMES.OFFER, OUTCOMES.REJECTED, OUTCOMES.LOST_TOUCH, OUTCOMES.WITHDREW];
    default:
      return [];
  }
}

export function nextCreatableType(status: string): OutreachType | null {
  if (status === STATES.NOT_CONTACTED) return "initial";
  if (status === STATES.SENT) return "followup_1";
  if (status === STATES.FOLLOWUP_1_SENT) return "followup_2";
  return null;
}

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

export function isPostReplyState(status: string): boolean {
  return POST_REPLY_STATES.has(status);
}

export function isOutcomeState(status: string): boolean {
  return OUTCOME_STATES.has(status);
}

export function canScheduleCoffeeChat(status: string): boolean {
  return status === STATES.REPLIED;
}

export function canCompleteCoffeeChat(status: string): boolean {
  return status === STATES.COFFEE_CHAT_SCHEDULED;
}

export function canScheduleInterview(status: string): boolean {
  return status === STATES.REPLIED
    || status === STATES.COFFEE_CHAT_COMPLETED;
}

export function canCompleteInterview(status: string): boolean {
  return status === STATES.INTERVIEW_SCHEDULED;
}

export function canRecordOutcome(status: string): boolean {
  return status === STATES.REPLIED
    || status === STATES.COFFEE_CHAT_SCHEDULED
    || status === STATES.COFFEE_CHAT_COMPLETED
    || status === STATES.INTERVIEW_SCHEDULED
    || status === STATES.INTERVIEW_COMPLETED;
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
    case STATES.COFFEE_CHAT_SCHEDULED: return "Unschedule coffee chat";
    case STATES.COFFEE_CHAT_COMPLETED: return "Undo coffee chat completion";
    case STATES.INTERVIEW_SCHEDULED: return "Unschedule interview";
    case STATES.INTERVIEW_COMPLETED: return "Undo interview completion";
    case STATES.OUTCOME_OFFER:
    case STATES.OUTCOME_REJECTED:
    case STATES.OUTCOME_WITHDREW:
    case STATES.OUTCOME_NOT_RIGHT_PERSON:
    case STATES.OUTCOME_NOT_A_FIT:
    case STATES.OUTCOME_LOST_TOUCH:
    case STATES.OUTCOME_CANCELLED:
    case STATES.OUTCOME_COMPANY_CANCELLED:
      return "Undo outcome";
    default: return "Undo";
  }
}
