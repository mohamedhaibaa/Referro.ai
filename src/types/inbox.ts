export type InboxActionType =
  | "FIND_CONTACTS"
  | "GENERATE_OUTREACH"
  | "SEND_OUTREACH"
  | "LOG_REPLY"
  | "INTERVIEW_PREP"
  | "WAITING_NUDGE"
  | "RATE_FIT"
  | "PREP_MEETING";

export type InboxCategory = "priority" | "waiting" | "setup";

export interface InboxAction {
  id: string;
  type: InboxActionType;
  title: string;
  subtitleTag: string;
  linkedJobId: string;
  companyName: string;
  roleTitle: string;
  sequenceTotal?: number;
  sequenceCurrent?: number;
  isCompleted: boolean;
  isSnoozed: boolean;
  category: InboxCategory;
}

export const ACTION_TYPE_CONFIG: Record<InboxActionType, { label: string; tag: string; icon: string }> = {
  FIND_CONTACTS: { label: "Find contacts", tag: "Setup", icon: "users" },
  GENERATE_OUTREACH: { label: "Generate outreach", tag: "Outreach", icon: "pen" },
  SEND_OUTREACH: { label: "Send outreach", tag: "Outreach", icon: "send" },
  LOG_REPLY: { label: "Log reply", tag: "Engagement", icon: "message-circle" },
  INTERVIEW_PREP: { label: "Prep interview", tag: "Interview Prep", icon: "briefcase" },
  WAITING_NUDGE: { label: "Still waiting", tag: "Follow-up", icon: "clock" },
  RATE_FIT: { label: "Rate fit", tag: "Setup", icon: "star" },
  PREP_MEETING: { label: "Prep coffee chat", tag: "Meeting", icon: "coffee" },
};
