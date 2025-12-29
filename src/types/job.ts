export type JobStatus = 
  | "Interested"
  | "Outreach Ready"
  | "Outreach Sent"
  | "Replied"
  | "Meeting Booked"
  | "Interviewing"
  | "Offer"
  | "Closed";

export interface Job {
  id: string;
  title: string;
  company: string;
  dueDate: string;
  status: JobStatus;
  url: string;
  description?: string;
  progress: number;
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
  name: string;
  title: string;
  relationship: "Recruiter" | "Hiring Manager" | "Team Lead" | "Employee";
  confidence: "High" | "Medium" | "Low";
  source: string;
  profileUrl?: string;
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
