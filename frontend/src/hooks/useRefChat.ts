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
      // REF-22: also invalidate when an undo, a draft create, or a followup
      // create comes back — these all change lifecycle state and need
      // contacts + outreach to refresh.
      const includesDraftCreate = response.newMessages.some(
        (m) => m.role === "ref" && m.kind === "draft_card",
      );
      const includesStateChange = response.requiresFollowup === "mark_sent" ||
        response.requiresFollowup === "mark_replied";
      if (includesDraftCreate || includesStateChange) {
        qc.invalidateQueries({ queryKey: ["contacts", jobId] });
        qc.invalidateQueries({ queryKey: ["outreach", jobId, contactId] });
      } else {
        // Undo flows: server already mutated lifecycle (UndoSent /
        // DeleteCurrentDraft) but didn't set requires_followup. Refresh
        // contacts so the popup reads the rolled-back state.
        qc.invalidateQueries({ queryKey: ["contacts", jobId] });
        qc.invalidateQueries({ queryKey: ["outreach", jobId, contactId] });
      }
    },
    onError: (err: unknown) => {
      // DQ-2: server emits 400 with detail "Action 'X' is not valid in
      // state 'Y'" when the user clicks a stale historical action_buttons
      // row. Surface a specific toast so the user understands the state
      // moved on rather than the network failing.
      const msg = (err as { message?: string })?.message ?? "";
      if (msg.includes("is not valid in state")) {
        toast.error("That button is no longer valid — the conversation has moved on. Use the latest buttons below.");
      } else {
        toast.error("Couldn't send. Try again?");
      }
    },
  });
}
