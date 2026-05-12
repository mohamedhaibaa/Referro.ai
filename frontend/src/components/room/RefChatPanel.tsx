import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Contact, Job } from "@/types/job";
import {
  RefChatActionDef,
  RefChatActionsContent,
  RefChatDraftContent,
  RefChatIntelContent,
  RefChatMessage,
  RefChatTextContent,
  RefChatUserActionContent,
} from "@/types/refChat";
import { Textarea } from "@/components/ui/textarea";
import { useContactOutreach, useUpdateOutreach } from "@/hooks/useOutreach";
import { useInitRefChat, useRefChatMessages, useSendRefChat } from "@/hooks/useRefChat";
import { STATES } from "@/lib/contactLifecycle";

interface RefChatPanelProps {
  contact: Contact;
  job: Job;
  onTransitionToSent: () => void;
}

/**
 * Chat-driven outreach panel for the `not_contacted` and `drafted` lifecycle
 * states. Replaces those branches inside MessageDraftView.
 *
 * Owns:
 *  - chat history (own React Query cache).
 *  - outreach query (so it can find the initial message ID for "Mark sent").
 *
 * Does NOT own:
 *  - lifecycle transitions (the chat endpoint and useUpdateOutreach do).
 *  - any state outside not_contacted / drafted.
 */
const RefChatPanel = ({ contact, job, onTransitionToSent }: RefChatPanelProps) => {
  const status = contact.lifecycleStatus ?? STATES.NOT_CONTACTED;
  const jobId = job.id;
  const contactId = contact.id;

  const { data: messages = [], isLoading: chatLoading } = useRefChatMessages(jobId, contactId, !!contactId);
  const initChat = useInitRefChat(jobId, contactId);
  const send = useSendRefChat(jobId, contactId);

  const { data: outreachMsgs = [] } = useContactOutreach(jobId, contactId, !!contactId);
  const updateOutreach = useUpdateOutreach(jobId, contactId);

  const initialMessage = useMemo(
    () => outreachMsgs.find((m) => m.type === "initial") ?? null,
    [outreachMsgs],
  );

  const [draftInput, setDraftInput] = useState("");
  const initFiredRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-init on first mount when chat is empty.
  // Triggers for not_contacted (full intro) and drafted (re-render existing draft).
  useEffect(() => {
    if (initFiredRef.current) return;
    if (chatLoading) return;
    if (messages.length > 0) return;
    if (status !== STATES.NOT_CONTACTED && status !== STATES.DRAFTED) return;
    if (initChat.isPending) return;
    initFiredRef.current = true;
    initChat.mutate();
  }, [chatLoading, messages.length, status, initChat]);

  // Scroll to bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, send.isPending]);

  // Latest draft_card drives the input's edits_left + disabled state.
  const latestDraftCard = useMemo<RefChatDraftContent | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "ref" && m.kind === "draft_card") {
        return m.content as RefChatDraftContent;
      }
    }
    return null;
  }, [messages]);

  // Has the user already approved the current draft? If yes, hide the editor
  // (the latest action_buttons will be Copy / Open LinkedIn / Mark sent).
  const draftApproved = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "user") continue;
      if (m.kind !== "action") continue;
      const action = (m.content as RefChatUserActionContent).action;
      if (action === "approve_draft") return true;
      if (action === "she_accepted") return false; // most recent approve/she_accepted wins
    }
    return false;
  }, [messages]);

  const editsLeft = latestDraftCard?.edits_left ?? 0;
  const editorVisible = status === STATES.DRAFTED && !draftApproved;
  const editorDisabled = !editorVisible || editsLeft <= 0 || send.isPending;

  // --- Action dispatcher ---
  // Handles client-only buttons (copy / open_linkedin) inline, routes
  // server-bound buttons through useSendRefChat. The "Mark sent" branch
  // chains useUpdateOutreach to PATCH sent_at — the canonical lifecycle path.
  const handleAction = (actionKind: string) => {
    if (actionKind === "copy") {
      const text = latestDraftCard?.text ?? "";
      if (!text) {
        toast.error("Nothing to copy yet.");
        return;
      }
      navigator.clipboard
        .writeText(text)
        .then(() => toast.success("Copied to clipboard"))
        .catch(() => toast.error("Couldn't copy to clipboard."));
      return;
    }
    if (actionKind === "open_linkedin") {
      if (contact.linkedinUrl) {
        window.open(contact.linkedinUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    if (
      actionKind === "sent_connection_request" ||
      actionKind === "she_accepted" ||
      actionKind === "approve_draft" ||
      actionKind === "mark_sent"
    ) {
      send.mutate(
        { kind: "action", content: { action: actionKind } },
        {
          onSuccess: (response) => {
            if (response.requiresFollowup === "mark_sent") {
              if (!initialMessage) {
                toast.error("Couldn't find the initial message to mark sent.");
                return;
              }
              updateOutreach.mutate(
                {
                  outreachId: initialMessage.id,
                  patch: { sent_at: new Date().toISOString() },
                },
                {
                  onSuccess: () => {
                    onTransitionToSent();
                  },
                },
              );
            }
          },
        },
      );
    }
  };

  const handleSendDraft = () => {
    const text = draftInput.trim();
    if (!text || editorDisabled) return;
    send.mutate(
      { kind: "text", content: { text }, edits_left: editsLeft },
      {
        onSuccess: () => setDraftInput(""),
      },
    );
  };

  // --- Render ---

  if (chatLoading || (messages.length === 0 && initChat.isPending)) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[480px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 space-y-3">
        {messages.map((m) => (
          <ChatMessageRow
            key={m.id}
            message={m}
            onAction={handleAction}
            disabled={send.isPending || updateOutreach.isPending}
          />
        ))}
        {(send.isPending || updateOutreach.isPending) && <TypingIndicator />}
      </div>

      {editorVisible && (
        <div className="border-t border-border pt-3 mt-3 space-y-1.5">
          <p className="text-[11px] text-muted-foreground px-1">
            {editsLeft} {editsLeft === 1 ? "edit" : "edits"} left
          </p>
          <div className="flex items-end gap-2">
            <Textarea
              value={draftInput}
              onChange={(e) => setDraftInput(e.target.value)}
              placeholder={
                editsLeft <= 0
                  ? "0 edits left — hit Looks fire 🔥 to send"
                  : "Tell me what to tweak…"
              }
              rows={2}
              disabled={editorDisabled}
              className="resize-none text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendDraft();
                }
              }}
            />
            <button
              type="button"
              onClick={handleSendDraft}
              disabled={editorDisabled || !draftInput.trim()}
              className="p-2.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send"
            >
              {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---- Sub-components (inline; not exported) ----

interface RowProps {
  message: RefChatMessage;
  onAction: (kind: string) => void;
  disabled: boolean;
}

const ChatMessageRow = ({ message, onAction, disabled }: RowProps) => {
  if (message.role === "user") {
    if (message.kind === "text") {
      return <UserBubble text={(message.content as RefChatTextContent).text} />;
    }
    if (message.kind === "action") {
      const c = message.content as RefChatUserActionContent;
      return <UserActionChip action={c.action} />;
    }
    return null;
  }

  // role === "ref"
  switch (message.kind) {
    case "text":
      return <RefBubble text={(message.content as RefChatTextContent).text} />;
    case "intel_card":
      return <IntelCard content={message.content as RefChatIntelContent} />;
    case "draft_card":
      return <DraftCard content={message.content as RefChatDraftContent} />;
    case "action_buttons":
      return (
        <ActionButtons
          actions={(message.content as RefChatActionsContent).actions}
          onClick={onAction}
          disabled={disabled}
        />
      );
    default:
      return null;
  }
};

const RefAvatar = () => (
  <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
    <Sparkles className="w-3.5 h-3.5" />
  </div>
);

const RefBubble = ({ text }: { text: string }) => (
  <div className="flex items-start gap-2 max-w-[85%]">
    <RefAvatar />
    <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-foreground whitespace-pre-wrap">
      {text}
    </div>
  </div>
);

const UserBubble = ({ text }: { text: string }) => (
  <div className="flex items-start gap-2 max-w-[85%] ml-auto justify-end">
    <div className="rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap">
      {text}
    </div>
  </div>
);

const ACTION_LABELS: Record<string, string> = {
  sent_connection_request: "Sent connection request",
  she_accepted: "They accepted",
  approve_draft: "Approved",
  mark_sent: "Marked sent",
};

const UserActionChip = ({ action }: { action: string }) => (
  <div className="flex justify-end">
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
      ✓ {ACTION_LABELS[action] ?? action.replace(/_/g, " ")}
    </span>
  </div>
);

const TypingIndicator = () => (
  <div className="flex items-start gap-2">
    <RefAvatar />
    <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            animation: "referroing-dot-pulse 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
          className="block w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
        />
      ))}
    </div>
  </div>
);

const IntelCard = ({ content }: { content: RefChatIntelContent }) => (
  <div className="ml-9 max-w-[85%]">
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {content.title}
      </p>
      <ul className="space-y-1">
        {content.items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-foreground">
            <span className="text-base shrink-0">{item.icon}</span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const DraftCard = ({ content }: { content: RefChatDraftContent }) => (
  <div className="ml-9 max-w-[85%]">
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <p className="text-sm text-foreground whitespace-pre-wrap">{content.text}</p>
    </div>
  </div>
);

interface ActionButtonsProps {
  actions: RefChatActionDef[];
  onClick: (kind: string) => void;
  disabled: boolean;
}

const ActionButtons = ({ actions, onClick, disabled }: ActionButtonsProps) => (
  <div className="ml-9 flex flex-wrap gap-2">
    {actions.map((a, i) => (
      <button
        key={`${a.kind}-${i}`}
        type="button"
        onClick={() => onClick(a.kind)}
        disabled={disabled}
        className={
          a.primary
            ? "px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            : "px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        }
      >
        {a.label}
      </button>
    ))}
  </div>
);

export default RefChatPanel;
