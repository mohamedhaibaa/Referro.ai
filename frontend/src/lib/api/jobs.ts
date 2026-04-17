import { api } from "./client";
import { Job } from "@/types/job";

interface ApiJob {
  id: string;
  title: string;
  company: string;
  companyLogoUrl?: string;
  url: string;
  description?: string;
  status: string;
  fitScore?: string;
  workMode?: string;
  roleFamily?: string;
  dueDate?: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  workflowRunId?: string | null;
}

function toJob(j: ApiJob): Job {
  return {
    id: j.id,
    title: j.title || "Untitled",
    company: j.company || "",
    companyLogoUrl: j.companyLogoUrl,
    url: j.url,
    description: j.description,
    status: (j.status as Job["status"]) ?? "Interested",
    fitScore: (j.fitScore as Job["fitScore"]) ?? null,
    workMode: j.workMode as Job["workMode"],
    roleFamily: j.roleFamily as Job["roleFamily"],
    dueDate: j.dueDate ?? "",
    progress: j.progress ?? 0,
    hasSelectedContact: false,
    hasOutreachDraft: false,
    outreachMarkedSent: false,
    milestones: {
      resumeTailored: false,
      contactSelected: false,
      outreachSent: false,
      followUpSent: false,
      replyReceived: false,
      interviewScheduled: false,
      interviewPrep1: false,
      interviewPrep2: false,
      interviewPrep3: false,
      outcomeRecorded: false,
    },
    workflowRunId: j.workflowRunId ?? null,
  };
}

interface ListJobsResponse {
  data: ApiJob[];
  meta: { total: number };
  error: string | null;
}

interface SingleJobResponse {
  data: ApiJob;
  error: string | null;
}

export async function listJobs(): Promise<Job[]> {
  const res = await api.get<ListJobsResponse>("/jobs");
  return res.data.map(toJob);
}

export async function listArchivedJobs(): Promise<Job[]> {
  const res = await api.get<ListJobsResponse>("/jobs?archived=true");
  return res.data.map(toJob);
}

export async function getJob(id: string): Promise<Job> {
  const res = await api.get<SingleJobResponse>(`/jobs/${id}`);
  return toJob(res.data);
}

export async function createJob(url: string, title = "", company = ""): Promise<Job> {
  const res = await api.post<SingleJobResponse>("/jobs", { url, title, company });
  return toJob(res.data);
}

export async function updateJob(id: string, patch: Partial<{
  status: string;
  title: string;
  company: string;
  due_date: string;
  progress: number;
  fit_score: string;
  work_mode: string;
  role_family: string;
}>): Promise<Job> {
  const res = await api.patch<SingleJobResponse>(`/jobs/${id}`, patch);
  return toJob(res.data);
}

export async function deleteJob(id: string): Promise<void> {
  await api.delete(`/jobs/${id}`);
}

export interface Milestones {
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
}

interface MilestonesResponse {
  data: Milestones;
  error: string | null;
}

export async function getMilestones(jobId: string): Promise<Milestones> {
  const res = await api.get<MilestonesResponse>(`/jobs/${jobId}/milestones`);
  return res.data;
}

const MILESTONE_TO_SNAKE: Record<keyof Milestones, string> = {
  resumeTailored: "resume_tailored",
  contactSelected: "contact_selected",
  outreachSent: "outreach_sent",
  followUpSent: "follow_up_sent",
  replyReceived: "reply_received",
  interviewScheduled: "interview_scheduled",
  interviewPrep1: "interview_prep_1",
  interviewPrep2: "interview_prep_2",
  interviewPrep3: "interview_prep_3",
  outcomeRecorded: "outcome_recorded",
};

export async function updateMilestones(jobId: string, patch: Partial<Milestones>): Promise<Milestones> {
  const body: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const snake = MILESTONE_TO_SNAKE[k as keyof Milestones];
    if (snake) body[snake] = v as boolean;
  }
  const res = await api.patch<MilestonesResponse>(`/jobs/${jobId}/milestones`, body);
  return res.data;
}
