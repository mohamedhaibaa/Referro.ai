import { Job } from "@/types/job";
import { InboxAction, InboxCategory } from "@/types/inbox";

export function generateInboxActionsFromJobs(jobs: Job[]): InboxAction[] {
  const actions: InboxAction[] = [];

  jobs.forEach((job) => {
    // Setup Gaps
    if (!job.fitScore) {
      actions.push({
        id: `${job.id}-rate-fit`,
        type: "RATE_FIT",
        title: `Rate fit — ${job.company} (${job.title})`,
        subtitleTag: "Setup",
        linkedJobId: job.id,
        companyName: job.company,
        roleTitle: job.title,
        isCompleted: false,
        isSnoozed: false,
        category: "setup",
      });
    }

    if (!job.hasSelectedContact && job.status !== "Closed") {
      actions.push({
        id: `${job.id}-find-contacts`,
        type: "FIND_CONTACTS",
        title: `Find contacts — ${job.company} (${job.title})`,
        subtitleTag: "Setup",
        linkedJobId: job.id,
        companyName: job.company,
        roleTitle: job.title,
        isCompleted: false,
        isSnoozed: false,
        category: "setup",
      });
    }

    // Priority Actions
    if (job.hasSelectedContact && !job.hasOutreachDraft && job.status !== "Closed") {
      actions.push({
        id: `${job.id}-generate-outreach`,
        type: "GENERATE_OUTREACH",
        title: `Generate outreach — ${job.company} (${job.title})`,
        subtitleTag: "Outreach",
        linkedJobId: job.id,
        companyName: job.company,
        roleTitle: job.title,
        isCompleted: false,
        isSnoozed: false,
        category: "priority",
      });
    }

    if (job.hasOutreachDraft && !job.outreachMarkedSent && job.status !== "Closed") {
      actions.push({
        id: `${job.id}-send-outreach`,
        type: "SEND_OUTREACH",
        title: `Send outreach — ${job.company} (${job.title})`,
        subtitleTag: "Outreach",
        linkedJobId: job.id,
        companyName: job.company,
        roleTitle: job.title,
        isCompleted: false,
        isSnoozed: false,
        category: "priority",
      });
    }

    if (job.status === "Replied") {
      actions.push({
        id: `${job.id}-log-reply`,
        type: "LOG_REPLY",
        title: `Log reply — ${job.company} (${job.title})`,
        subtitleTag: "Engagement",
        linkedJobId: job.id,
        companyName: job.company,
        roleTitle: job.title,
        isCompleted: false,
        isSnoozed: false,
        category: "priority",
      });
    }

    if (job.status === "Meeting Booked") {
      actions.push({
        id: `${job.id}-prep-meeting`,
        type: "PREP_MEETING",
        title: `Prep coffee chat — ${job.company} (${job.title})`,
        subtitleTag: "Meeting",
        linkedJobId: job.id,
        companyName: job.company,
        roleTitle: job.title,
        isCompleted: false,
        isSnoozed: false,
        category: "priority",
      });
    }

    if (job.status === "Interviewing") {
      const prepStep = getInterviewPrepStep(job);
      actions.push({
        id: `${job.id}-interview-prep`,
        type: "INTERVIEW_PREP",
        title: `Prep interview — ${job.company} (${job.title})`,
        subtitleTag: "Interview Prep",
        linkedJobId: job.id,
        companyName: job.company,
        roleTitle: job.title,
        sequenceTotal: 3,
        sequenceCurrent: prepStep,
        isCompleted: false,
        isSnoozed: false,
        category: "priority",
      });
    }

    // Waiting / Nudges
    if (job.status === "Outreach Sent") {
      actions.push({
        id: `${job.id}-waiting`,
        type: "WAITING_NUDGE",
        title: `Still waiting — ${job.company} (${job.title})`,
        subtitleTag: "Follow-up",
        linkedJobId: job.id,
        companyName: job.company,
        roleTitle: job.title,
        isCompleted: false,
        isSnoozed: false,
        category: "waiting",
      });
    }
  });

  return actions;
}

function getInterviewPrepStep(job: Job): number {
  const { interviewPrep1, interviewPrep2, interviewPrep3 } = job.milestones;
  if (interviewPrep3) return 3;
  if (interviewPrep2) return 2;
  if (interviewPrep1) return 1;
  return 1;
}

export function groupActionsByCategory(actions: InboxAction[]): {
  priority: InboxAction[];
  waiting: InboxAction[];
  setup: InboxAction[];
} {
  return {
    priority: actions.filter((a) => a.category === "priority" && !a.isSnoozed && !a.isCompleted).slice(0, 6),
    waiting: actions.filter((a) => a.category === "waiting" && !a.isSnoozed && !a.isCompleted),
    setup: actions.filter((a) => a.category === "setup" && !a.isSnoozed && !a.isCompleted),
  };
}
