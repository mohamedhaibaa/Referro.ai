import { api } from "./client";
import { Contact } from "@/types/job";

interface ContactsResponse {
  data: Contact[];
  meta: { count: number };
  error: string | null;
}

interface DiscoverResponse {
  data: { workflowRunId: string };
  meta: Record<string, unknown>;
  error: string | null;
}

export async function getContacts(jobId: string): Promise<Contact[]> {
  const res = await api.get<ContactsResponse>(`/jobs/${jobId}/contacts`);
  return res.data;
}

export async function discoverContacts(jobId: string): Promise<string> {
  const res = await api.post<DiscoverResponse>(`/jobs/${jobId}/contacts/discover`);
  return res.data.workflowRunId;
}
