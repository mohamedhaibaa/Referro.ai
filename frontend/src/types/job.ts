export type JobStatus = 
  | "Interested"
  | "Outreach Ready"
  | "Outreach Sent"
  | "Replied"
  | "Meeting Booked"
  | "Interviewing"
  | "Offer"
  | "Closed";

export type FitScore = "High" | "Medium" | "Low" | null;
export type WorkMode = "Remote" | "Hybrid" | "On-site";
export type RoleFamily = "PM" | "SWE" | "DS" | "Design" | "Other";

export interface Job {
  id: string;
  title: string;
  company: string;
  companyLogoUrl?: string;
  dueDate: string;
  status: JobStatus;
  url: string;
  description?: string;
  progress: number;
  fitScore?: FitScore;
  workMode?: WorkMode;
  roleFamily?: RoleFamily;
  hasSelectedContact: boolean;
  hasOutreachDraft: boolean;
  outreachMarkedSent: boolean;
  milestones: {
    resumeTailored: boolean;
    contactSelected: boolean;
    outreachSent: boolean;
    followUpSent: boolean;
    replyReceived: boolean;
    interviewScheduled: boolean;
    interviewPrep1: boolean;
    interviewPrep2: boolean;
    interviewPrep3: boolean;
    outcomeRecorded: boolean;
  };
  contacts?: Contact[];
  selectedContactId?: string;
  outreachMessages?: OutreachMessage[];
  followUp?: FollowUp;
  notes?: string;
  tags?: string[];
  outcome?: "Offer" | "Rejected" | "Withdrew" | "No response";
  activityTimeline?: ActivityItem[];
}

export interface Contact {
  id: string;
  fullName: string;
  title: string;
  company: string;
  location: string;
  linkedinUrl?: string;
  university?: string;
  tenureMonths?: number;
  relevanceScore?: number;
  relationship: "Recruiter" | "Hiring Manager" | "Team Lead" | "Employee";
  confidence: "High" | "Medium" | "Low";
  source: string;
  createdAt?: string;
}

export interface OutreachMessage {
  id: string;
  message: string;
  sentAt?: string;
  type: "initial" | "followup";
}

export interface FollowUp {
  recommendedDate: string;
  message: string;
  sent: boolean;
  sentAt?: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  timestamp: string;
}

export const PIPELINE_STAGES: JobStatus[] = [
  "Interested",
  "Outreach Ready",
  "Outreach Sent",
  "Replied",
  "Meeting Booked",
  "Interviewing",
  "Offer",
  "Closed",
];

export const getNextStepLabel = (job: Job): string => {
  if (!job.hasSelectedContact) return "Find Contacts";
  if (!job.hasOutreachDraft) return "Generate Outreach";
  if (!job.outreachMarkedSent) return "Mark Outreach Sent";
  if (job.status === "Outreach Sent") return "Follow-up Prep";
  if (job.status === "Replied") return "Log Reply";
  if (job.status === "Meeting Booked") return "Prep Coffee Chat";
  if (job.status === "Interviewing") return "Start Interview Prep";
  if (job.status === "Offer") return "Review Offer";
  if (job.status === "Closed") return "View Summary";
  return "Next Step";
};
