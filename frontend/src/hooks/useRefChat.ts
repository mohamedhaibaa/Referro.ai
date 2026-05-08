import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { initRefChat, listRefChat, postRefChat } from "@/lib/api/refChat";
import { PostRefChatBody, PostRefChatResponse, RefChatMessage } from "@/types/refChat";

const refChatKey = (jobId: string, contactId: string) =>
  ["ref-chat", jobId, contactId] as const;

export function useRefChatMessages(jobId: string, contactId: string, enabled = true) {
  return useQuery({
    queryKey: refChatKey(jobId, contactId),
    queryFn: () => listRefChat(jobId, contactId),
    enabled: enabled && !!jobId && !!contactId,
  });
}

export function useInitRefChat(jobId: string, contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => initRefChat(jobId, contactId),
    onSuccess: (msgs: RefChatMessage[]) => {
      qc.setQueryData<RefChatMessage[]>(refChatKey(jobId, contactId), msgs);
    },
    onError: () => {
      toast.error("Couldn't start the chat. Try again?");
    },
  });
}

export function useSendRefChat(jobId: string, contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PostRefChatBody) => postRefChat(jobId, contactId, body),
    onSuccess: (response: PostRefChatResponse) => {
      qc.setQueryData<RefChatMessage[]>(refChatKey(jobId, contactId), (old) =>
        [...(old ?? []), ...response.newMessages],
      );
      // If a draft_card came back, the server just created an OutreachMessage
      // (transition NOT_CONTACTED -> drafted). Refresh contacts + outreach so
      // RefChatPanel sees the new initial message ID and the parent popup
      // re-evaluates lifecycle.
      const includesDraftCreate = response.newMessages.some(
        (m) => m.role === "ref" && m.kind === "draft_card",
      );
      if (includesDraftCreate) {
        qc.invalidateQueries({ queryKey: ["contacts", jobId] });
        qc.invalidateQueries({ queryKey: ["outreach", jobId, contactId] });
      }
    },
    onError: () => {
      toast.error("Couldn't send. Try again?");
    },
  });
}
