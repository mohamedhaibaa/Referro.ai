import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Contact, OutreachMessage, OutreachType, Job } from "@/types/job";
import { Textarea } from "@/components/ui/textarea";
import {
  STATES,
  canMarkReplied,
  canMarkSent,
  canUndo,
  currentDraftType,
  nextCreatableType,
  statusLabel,
  undoLabel,
} from "@/lib/contactLifecycle";
import { useCreateOutreach, useUpdateOutreach, useDeleteOutreach } from "@/hooks/useOutreach";

interface MessageDraftViewProps {
  job: Job;
  contact: Contact;
  messages: OutreachMessage[];
  onMarkReplied: () => void;
  onUndo: () => void;
}

const AUTO_SAVE_DEBOUNCE_MS = 500;

function buildStub(contact: Contact): string {
  const first = (contact.fullName || "there").split(" ")[0];
  return `Hi ${first},\n\n[Your AI-generated outreach message will appear here. For now, feel free to write your own.]`;
}

function typeLabel(type: OutreachType): string {
  if (type === "initial") return "Initial message";
  if (type === "followup_1") return "Follow-up 1";
  return "Follow-up 2";
}

function relativeFrom(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days >= 1) return days === 1 ? "1 day ago" : `${days} days ago`;
  const hrs = Math.floor(diff / (60 * 60 * 1000));
  if (hrs >= 1) return hrs === 1 ? "1 hr ago" : `${hrs} hrs ago`;
  const mins = Math.floor(diff / (60 * 1000));
  if (mins >= 1) return mins === 1 ? "1 min ago" : `${mins} mins ago`;
  return "just now";
}

const MessageDraftView = ({ job, contact, messages, onMarkReplied, onUndo }: MessageDraftViewProps) => {
  const navigate = useNavigate();
  const status = contact.lifecycleStatus ?? STATES.NOT_CONTACTED;

  const createOutreach = useCreateOutreach(job.id, contact.id);
  const updateOutreach = useUpdateOutreach(job.id, contact.id);
  const deleteOutreach = useDeleteOutreach(job.id, contact.id);

  // Ordered oldest → newest. "Current" is the message being drafted OR the latest sent.
  const ordered = useMemo(
    () => [...messages].sort((a, b) =>
      new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
    ),
    [messages]
  );

  const draftType = currentDraftType(status);
  const creatableType = nextCreatableType(status);

  const currentDraft = draftType ? ordered.find((m) => m.type === draftType) : null;
  const latestSent = [...ordered].reverse().find((m) => !!m.sentAt) ?? null;

  // When draft exists → show its body in the editor. When only sent exists → show "sent, waiting" view.
  // When next-creatable type exists → show empty editor primed for that type.
  const [draftText, setDraftText] = useState<string>("");
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // Sync draftText from server state on load / when current draft changes.
  useEffect(() => {
    if (currentDraft) setDraftText(currentDraft.message);
    else setDraftText("");
  }, [currentDraft?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-save
  const debounceRef = useRef<number | null>(null);
  const flush = useRef<() => void>(() => {});
  flush.current = () => {
    if (!currentDraft) return;
    if (draftText === currentDraft.message) return;
    updateOutreach.mutate({
      outreachId: currentDraft.id,
      patch: { message: draftText },
    });
  };

  useEffect(() => {
    if (!currentDraft) return;
    if (draftText === currentDraft.message) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      flush.current();
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [draftText, currentDraft?.id, currentDraft?.message]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush on unmount
  useEffect(() => () => flush.current(), []);

  const handleDraftMessage = () => {
    if (!creatableType) return;
    const stub = buildStub(contact);
    createOutreach.mutate({ type: creatableType, message: stub, isAiGenerated: false });
  };

  const handleCopy = async () => {
    flush.current();
    try {
      await navigator.clipboard.writeText(draftText || currentDraft?.message || "");
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  const handleMarkSent = () => {
    if (!currentDraft) return;
    flush.current();
    updateOutreach.mutate({
      outreachId: currentDraft.id,
      patch: { message: draftText, sent_at: new Date().toISOString() },
    });
  };

  const isBusy = createOutreach.isPending || updateOutreach.isPending || deleteOutreach.isPending;

  // --- Render branches ---

  // Terminal state: user marked replied
  if (status === STATES.REPLIED) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-base text-foreground mb-1">Marked replied</p>
          <p className="text-sm text-muted-foreground">
            Outcome tracking (coffee chat, interview, offer) coming soon.
          </p>
        </div>
        {canUndo(status) && (
          <div className="flex justify-end">
            <button
              onClick={onUndo}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
            >
              {undoLabel(status)}
            </button>
          </div>
        )}
      </div>
    );
  }

  // State: Sent / FU1 sent / FU2 sent — show "waiting for reply" view with action buttons
  if (
    status === STATES.SENT ||
    status === STATES.FOLLOWUP_1_SENT ||
    status === STATES.FOLLOWUP_2_SENT
  ) {
    const canFollowUp = !!creatableType;
    return (
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-foreground font-medium">
            {statusLabel(status)}
            {latestSent?.sentAt && (
              <span className="text-muted-foreground font-normal"> · {relativeFrom(latestSent.sentAt)}</span>
            )}
          </p>
        </div>

        <MessageHistory
          ordered={ordered}
          expanded={historyExpanded}
          setExpanded={setHistoryExpanded}
        />

        <div className="flex items-center gap-2 flex-wrap pt-2">
          {canMarkReplied(status) && (
            <button
              onClick={onMarkReplied}
              className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              They replied
            </button>
          )}
          {canFollowUp && (
            <button
              onClick={handleDraftMessage}
              disabled={isBusy}
              className="px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            >
              Draft follow-up
            </button>
          )}
          {contact.linkedinUrl && (
            <a
              href={contact.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted transition-colors"
            >
              Open LinkedIn
            </a>
          )}
          <div className="flex-1" />
          {canUndo(status) && (
            <button
              onClick={onUndo}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
            >
              {undoLabel(status)}
            </button>
          )}
        </div>
      </div>
    );
  }

  // State: Not contacted — show "Draft message" starter
  if (status === STATES.NOT_CONTACTED) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-dashed border-border p-8 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            Not contacted yet. Start with a message to reach out.
          </p>
          <button
            onClick={handleDraftMessage}
            disabled={isBusy}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {createOutreach.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Draft message
          </button>
          <span className="text-[11px] text-muted-foreground">
            ✨ placeholder — real AI generation coming soon
          </span>
          <button
            type="button"
            onClick={() => navigate(`/jobs/${job.id}/contacts/${contact.id}/pitch-deck`)}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4 mt-1"
          >
            Or send a pitch deck →
          </button>
        </div>
      </div>
    );
  }

  // State: Drafted / FU1 drafted / FU2 drafted — editable textarea
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-foreground font-medium">
          {draftType ? typeLabel(draftType) : "Draft"}
          <span className="text-muted-foreground font-normal"> · editing</span>
        </p>
      </div>

      <Textarea
        value={draftText}
        onChange={(e) => setDraftText(e.target.value)}
        rows={10}
        className="w-full text-sm font-sans resize-none"
        placeholder="Your message..."
      />

      {ordered.length > 1 && (
        <MessageHistory
          ordered={ordered.filter((m) => m.id !== currentDraft?.id)}
          expanded={historyExpanded}
          setExpanded={setHistoryExpanded}
        />
      )}

      <div className="flex items-center gap-2 flex-wrap pt-2">
        <button
          onClick={handleCopy}
          disabled={!draftText.trim() || isBusy}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-40"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy
        </button>
        {contact.linkedinUrl && (
          <a
            href={contact.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted transition-colors"
          >
            Open LinkedIn
          </a>
        )}
        {canMarkSent(status) && (
          <button
            onClick={handleMarkSent}
            disabled={!draftText.trim() || isBusy}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {updateOutreach.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mark sent"}
          </button>
        )}
        <div className="flex-1" />
        {canUndo(status) && (
          <button
            onClick={onUndo}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
          >
            {undoLabel(status)}
          </button>
        )}
      </div>
    </div>
  );
};

interface MessageHistoryProps {
  ordered: OutreachMessage[];
  expanded: boolean;
  setExpanded: (v: boolean) => void;
}

const MessageHistory = ({ ordered, expanded, setExpanded }: MessageHistoryProps) => {
  if (ordered.length === 0) return null;
  const latest = ordered[ordered.length - 1];
  const earlier = ordered.slice(0, -1);

  return (
    <div className="space-y-3">
      {/* Latest — always expanded */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs font-medium text-foreground">{typeLabel(latest.type)}</p>
          <p className="text-xs text-muted-foreground">
            {latest.sentAt ? `sent ${relativeFrom(latest.sentAt)}` : "draft"}
          </p>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap">{latest.message}</p>
      </div>

      {earlier.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {expanded ? "Hide" : "Show"} {earlier.length} earlier message{earlier.length === 1 ? "" : "s"}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              {earlier.map((m) => (
                <div key={m.id} className="rounded-xl border border-border bg-muted/10 p-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <p className="text-xs font-medium text-foreground">{typeLabel(m.type)}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.sentAt ? `sent ${relativeFrom(m.sentAt)}` : "draft"}
                    </p>
                  </div>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{m.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageDraftView;
