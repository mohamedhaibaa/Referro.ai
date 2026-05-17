import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Coffee,
  Briefcase,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Contact, Job, OutreachMessage } from "@/types/job";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { patchContact } from "@/lib/api/contacts";
import {
  STATES,
  canCompleteCoffeeChat,
  canCompleteInterview,
  canRecordOutcome,
  canScheduleCoffeeChat,
  canScheduleInterview,
  canUndo,
  isOutcomeState,
  statusLabel,
  undoLabel,
} from "@/lib/contactLifecycle";
import ActivityTimeline from "./ActivityTimeline";
import CelebrationView from "./CelebrationView";
import OutcomeDialog from "./OutcomeDialog";

// REF-30 (DQ-9): externally-driveable mode signal. REF-30's chat bridge
// passes `mode` to auto-open the relevant picker / dialog; subsequent
// internal mode changes notify the parent via onModeChange so it can
// clear its forcedView state.
export type PostReplyMode = "coffee_chat" | "interview" | "outcome" | null;

interface PostReplyViewProps {
  job: Job;
  contact: Contact;
  messages: OutreachMessage[];
  onUndo: () => void;
  onClose: () => void;
  mode?: PostReplyMode;                       // REF-30: external drive signal
  onModeChange?: (mode: PostReplyMode) => void;  // REF-30
}

type ScheduleMode = "coffee_chat" | "interview";

const PostReplyView = ({
  job, contact, messages, onUndo, onClose, mode, onModeChange,
}: PostReplyViewProps) => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const status = contact.lifecycleStatus ?? STATES.REPLIED;

  // Seed internal state from `mode` prop on initial mount (handles the
  // REF-30 bridge case where the popup opens PostReplyView with a
  // pre-set scheduling picker / outcome dialog).
  const [outcomeOpen, setOutcomeOpen] = useState<boolean>(mode === "outcome");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode | null>(
    mode === "coffee_chat" || mode === "interview" ? mode : null,
  );
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(
    mode === "coffee_chat" || mode === "interview" ? new Date() : undefined,
  );
  const [scheduleTime, setScheduleTime] = useState<string>("10:00");

  // External mode changes (parent flips `mode` mid-life) re-seed internal state.
  useEffect(() => {
    if (mode === undefined) return;  // uncontrolled by parent — keep internal state
    if (mode === "coffee_chat" || mode === "interview") {
      setScheduleMode(mode);
      setScheduleDate(new Date());
      setScheduleTime("10:00");
      setOutcomeOpen(false);
    } else if (mode === "outcome") {
      setOutcomeOpen(true);
      setScheduleMode(null);
    } else {
      // mode === null: clear both
      setScheduleMode(null);
      setOutcomeOpen(false);
    }
  }, [mode]);

  // Notify parent of internal mode changes (so parent can clear forcedView
  // after the user dismisses or completes the action).
  useEffect(() => {
    if (!onModeChange) return;
    const current: PostReplyMode = scheduleMode ?? (outcomeOpen ? "outcome" : null);
    onModeChange(current);
  }, [scheduleMode, outcomeOpen, onModeChange]);

  const patch = useMutation({
    mutationFn: (body: Parameters<typeof patchContact>[2]) =>
      patchContact(job.id, contact.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", job.id] });
    },
    onError: () => {
      toast.error("Couldn't save that change. Try again?");
    },
  });

  const isBusy = patch.isPending;

  const handleOpenSchedule = (mode: ScheduleMode) => {
    setScheduleMode(mode);
    setScheduleDate(new Date());
    setScheduleTime("10:00");
  };

  const handleConfirmSchedule = () => {
    if (!scheduleMode || !scheduleDate) return;
    const [hh, mm] = scheduleTime.split(":").map((s) => parseInt(s, 10));
    const when = new Date(scheduleDate);
    when.setHours(isNaN(hh) ? 10 : hh, isNaN(mm) ? 0 : mm, 0, 0);
    const iso = when.toISOString();

    if (scheduleMode === "coffee_chat") {
      patch.mutate({ coffee_chat_scheduled_at: iso }, {
        onSuccess: () => {
          setScheduleMode(null);
          toast.success("Coffee chat scheduled");
        },
      });
    } else {
      patch.mutate({ interview_scheduled_at: iso }, {
        onSuccess: () => {
          setScheduleMode(null);
          toast.success("Interview scheduled");
        },
      });
    }
  };

  const handleCompleteCoffee = () => {
    patch.mutate({ coffee_chat_completed_at: new Date().toISOString() });
  };

  const handleCompleteInterview = () => {
    patch.mutate({ interview_completed_at: new Date().toISOString() });
  };

  const handleRecordOutcome = (outcome: string) => {
    patch.mutate(
      { outcome },
      {
        onSuccess: () => {
          setOutcomeOpen(false);
          if (outcome !== "offer") {
            toast.success("Outcome recorded");
          }
        },
      }
    );
  };

  const goToPrep = (kind: "coffee-chat-prep" | "interview-prep") => {
    navigate(`/jobs/${job.id}/contacts/${contact.id}/${kind}`);
  };

  // --- Celebration override ---
  if (status === STATES.OUTCOME_OFFER) {
    return (
      <div className="space-y-6">
        <CelebrationView job={job} contact={contact} onClose={onClose} />
        <ActivityTimeline contact={contact} messages={messages} />
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

  // --- Other terminal outcome states ---
  if (isOutcomeState(status)) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-border p-6 text-center">
          <p className="text-base font-medium text-foreground mb-1">{statusLabel(status)}</p>
          <p className="text-sm text-muted-foreground">
            This outreach is closed. You can still reopen it by undoing.
          </p>
        </div>
        <ActivityTimeline contact={contact} messages={messages} />
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

  // --- Active post-reply states ---
  const scheduledCoffeeAt = contact.coffeeChatScheduledAt;
  const scheduledInterviewAt = contact.interviewScheduledAt;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-foreground font-medium">{statusLabel(status)}</p>
        {scheduledCoffeeAt && status === STATES.COFFEE_CHAT_SCHEDULED && (
          <p className="text-xs text-muted-foreground mt-1">
            Scheduled for {format(new Date(scheduledCoffeeAt), "EEE, MMM d · h:mm a")}
          </p>
        )}
        {scheduledInterviewAt && status === STATES.INTERVIEW_SCHEDULED && (
          <p className="text-xs text-muted-foreground mt-1">
            Scheduled for {format(new Date(scheduledInterviewAt), "EEE, MMM d · h:mm a")}
          </p>
        )}
      </div>

      {/* Schedule picker */}
      {scheduleMode && (
        <div className="rounded-2xl border border-border p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-medium text-foreground">
            {scheduleMode === "coffee_chat" ? "Schedule coffee chat" : "Schedule interview"}
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <Popover modal>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {scheduleDate ? format(scheduleDate, "EEE, MMM d") : "Pick a date"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[160]" align="start">
                <Calendar
                  mode="single"
                  selected={scheduleDate}
                  onSelect={setScheduleDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border text-sm bg-transparent text-foreground"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleConfirmSchedule}
              disabled={!scheduleDate || isBusy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm
            </button>
            <button
              onClick={() => setScheduleMode(null)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!scheduleMode && (
        <div className="flex items-center gap-2 flex-wrap">
          {canScheduleCoffeeChat(status) && (
            <button
              onClick={() => handleOpenSchedule("coffee_chat")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Coffee className="w-3.5 h-3.5" />
              Schedule coffee chat
            </button>
          )}
          {canCompleteCoffeeChat(status) && (
            <button
              onClick={handleCompleteCoffee}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark coffee chat completed
            </button>
          )}
          {canScheduleInterview(status) && (
            <button
              onClick={() => handleOpenSchedule("interview")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Briefcase className="w-3.5 h-3.5" />
              Schedule interview
            </button>
          )}
          {canCompleteInterview(status) && (
            <button
              onClick={handleCompleteInterview}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark interview completed
            </button>
          )}
          {status === STATES.COFFEE_CHAT_SCHEDULED && (
            <button
              onClick={() => goToPrep("coffee-chat-prep")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Prep for this
            </button>
          )}
          {status === STATES.INTERVIEW_SCHEDULED && (
            <button
              onClick={() => goToPrep("interview-prep")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Prep for this
            </button>
          )}
          {canRecordOutcome(status) && (
            <button
              onClick={() => setOutcomeOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted transition-colors"
            >
              Record outcome
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
      )}

      <ActivityTimeline contact={contact} messages={messages} />

      <OutcomeDialog
        open={outcomeOpen}
        onOpenChange={setOutcomeOpen}
        onConfirm={handleRecordOutcome}
        currentStatus={status}
        pending={isBusy}
      />
    </div>
  );
};

export default PostReplyView;
