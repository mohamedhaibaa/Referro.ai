import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { initRefChat, listRefChat, postRefChat, streamRefChatReply } from "@/lib/api/refChat";
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
  // REF-34: tracks the inter-chunk "Ref is drafting your response..."
  // state between chunk 1 (classification) and chunk 2 (draft_card).
  // Only flips true for the reply_paste stream path.
  const [isDrafting, setIsDrafting] = useState(false);

  const mutation = useMutation({
    mutationFn: async (body: PostRefChatBody): Promise<PostRefChatResponse | null> => {
      // REF-34: reply_paste returns NDJSON chunks; everything else uses
      // the standard JSON POST. The streamed path appends each chunk to
      // the React Query cache as it arrives and toggles isDrafting between
      // chunk 1 and chunk 2 so RefChatPanel can render <TypingIndicator />.
      if (body.kind === "reply_paste") {
        setIsDrafting(false);
        try {
          await streamRefChatReply(jobId, contactId, body, (payload) => {
            qc.setQueryData<RefChatMessage[]>(refChatKey(jobId, contactId), (old) =>
              [...(old ?? []), ...payload.newMessages],
            );
            if (payload.chunk === 1) {
              setIsDrafting(true);
            } else if (payload.chunk === 2) {
              setIsDrafting(false);
            }
          });
        } finally {
          setIsDrafting(false);
        }
        // Stream completed — invalidate downstream queries (contacts +
        // outreach) since the CaptureReply side-effect ran in chunk 1
        // and lifecycle moved sent → replied.
        qc.invalidateQueries({ queryKey: ["contacts", jobId] });
        qc.invalidateQueries({ queryKey: ["outreach", jobId, contactId] });
        return null;  // streamed; onSuccess is a no-op for this path
      }

      return await postRefChat(jobId, contactId, body);
    },
    onSuccess: (response: PostRefChatResponse | null) => {
      if (response === null) return;  // REF-34 streamed path already handled cache
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

  return { ...mutation, isDrafting };
}
