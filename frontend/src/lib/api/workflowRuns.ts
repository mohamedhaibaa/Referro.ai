import { api } from "./client";

export interface WorkflowRun {
  id: string;
  type: string;
  status: "queued" | "running" | "completed" | "failed";
  jobId: string | null;
  outputData: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface WorkflowRunResponse {
  data: WorkflowRun;
  error: string | null;
}

export async function getWorkflowRun(id: string): Promise<WorkflowRun> {
  const res = await api.get<WorkflowRunResponse>(`/workflow-runs/${id}`);
  return res.data;
}
