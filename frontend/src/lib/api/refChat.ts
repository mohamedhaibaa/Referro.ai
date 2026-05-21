import { api } from "./client";
import { PostRefChatBody, PostRefChatResponse, RefChatMessage } from "@/types/refChat";

interface ListResponse {
  data: RefChatMessage[];
  meta: { count: number };
  error: string | null;
}

interface PostResponse {
  data: PostRefChatResponse;
  meta: Record<string, unknown>;
  error: string | null;
}

export async function listRefChat(jobId: string, contactId: string): Promise<RefChatMessage[]> {
  const res = await api.get<ListResponse>(`/jobs/${jobId}/contacts/${contactId}/ref-chat`);
  return res.data;
}

export async function initRefChat(jobId: string, contactId: string): Promise<RefChatMessage[]> {
  const res = await api.post<ListResponse>(`/jobs/${jobId}/contacts/${contactId}/ref-chat/init`, {});
  return res.data;
}

export async function postRefChat(
  jobId: string,
  contactId: string,
  body: PostRefChatBody,
): Promise<PostRefChatResponse> {
  const res = await api.post<PostResponse>(`/jobs/${jobId}/contacts/${contactId}/ref-chat`, body);
  return res.data;
}

// REF-34: chunked NDJSON response for reply_paste flow.
// Chunk 1 = classification chip + Ref text (after parse_reply ~3-5s).
// Chunk 2 = draft_card + final action_buttons (after generate_followup ~3-7s).
export interface RefChatStreamChunk {
  chunk: 1 | 2;
  newMessages: RefChatMessage[];
}

export async function streamRefChatReply(
  jobId: string,
  contactId: string,
  body: PostRefChatBody,
  onChunk: (payload: RefChatStreamChunk) => void,
): Promise<void> {
  await api.stream<RefChatStreamChunk>(
    `/jobs/${jobId}/contacts/${contactId}/ref-chat`,
    body,
    onChunk,
  );
}
