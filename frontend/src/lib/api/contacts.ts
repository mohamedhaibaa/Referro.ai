import { api } from "./client";
import { Contact } from "@/types/job";

interface ContactsResponse {
  data: Contact[];
  meta: { count: number };
  error: string | null;
}

interface DiscoverResponse {
  data: {
    workflowRunId: string;
    batchNumber: number;
    hasMore: boolean;
  };
  meta: Record<string, unknown>;
  error: string | null;
}

interface RevisitResponse {
  data: {
    workflowRunId: string;
    roundNumber: number;
    batchNumber: number;
    hasMore: boolean;
  };
  meta: Record<string, unknown>;
  error: string | null;
}

export async function getContacts(jobId: string): Promise<Contact[]> {
  const res = await api.get<ContactsResponse>(`/jobs/${jobId}/contacts`);
  return res.data;
}

export async function discoverContacts(
  jobId: string,
  batchNumber: number = 1,
  roundNumber: number = 1
): Promise<{ workflowRunId: string; batchNumber: number; hasMore: boolean }> {
  const res = await api.post<DiscoverResponse>(`/jobs/${jobId}/contacts/discover`, {
    batch_number: batchNumber,
    round_number: roundNumber,
  });
  return res.data;
}

export async function revisitContacts(
  jobId: string
): Promise<{ workflowRunId: string; roundNumber: number; batchNumber: number; hasMore: boolean }> {
  const res = await api.post<RevisitResponse>(`/jobs/${jobId}/contacts/revisit`, {});
  return res.data;
}

interface PatchContactResponse {
  data: Contact;
  meta: Record<string, unknown>;
  error: string | null;
}

export async function setContactSelected(
  jobId: string,
  contactId: string,
  isSelected: boolean
): Promise<Contact> {
  const res = await api.patch<PatchContactResponse>(
    `/jobs/${jobId}/contacts/${contactId}`,
    { is_selected: isSelected }
  );
  return res.data;
}
