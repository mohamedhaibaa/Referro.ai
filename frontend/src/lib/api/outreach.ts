import { api } from "./client";
import { OutreachMessage, OutreachType } from "@/types/job";

interface ListResponse {
  data: OutreachMessage[];
  meta: { count: number };
  error: string | null;
}

interface SingleResponse {
  data: OutreachMessage;
  meta: Record<string, unknown>;
  error: string | null;
}

export async function listContactOutreach(
  jobId: string,
  contactId: string
): Promise<OutreachMessage[]> {
  const res = await api.get<ListResponse>(`/jobs/${jobId}/contacts/${contactId}/outreach`);
  return res.data;
}

export async function createOutreach(
  jobId: string,
  contactId: string,
  type: OutreachType,
  message: string,
  isAiGenerated = false
): Promise<OutreachMessage> {
  const res = await api.post<SingleResponse>(
    `/jobs/${jobId}/contacts/${contactId}/outreach`,
    { type, message, is_ai_generated: isAiGenerated }
  );
  return res.data;
}

export async function updateOutreach(
  jobId: string,
  outreachId: string,
  patch: { message?: string; sent_at?: string | null }
): Promise<OutreachMessage> {
  const res = await api.patch<SingleResponse>(`/jobs/${jobId}/outreach/${outreachId}`, patch);
  return res.data;
}

export async function deleteOutreach(jobId: string, outreachId: string): Promise<void> {
  await api.delete(`/jobs/${jobId}/outreach/${outreachId}`);
}
