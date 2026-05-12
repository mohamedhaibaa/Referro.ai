import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { Contact } from "@/types/job";
import ContactCard from "./ContactCard";
import EmptyState from "@/components/ui/EmptyState";
import { RadarSweepIllustration } from "@/components/ui/EmptyIllustrations";
import { useContacts, useDiscoverContacts } from "@/hooks/useContacts";
import { useToggleContactSelection } from "@/hooks/useContactSelection";

interface PickContactsPanelProps {
  jobId: string;
  onConfirm: () => void;
  confirming: boolean;
}

const MAX_BATCHES = 3;
const MAX_VISIBLE = 9;
const MAX_SELECTIONS = 9;

const PickContactsPanel = ({ jobId, onConfirm, confirming }: PickContactsPanelProps) => {
  const { data: contacts = [], isLoading, isFetching } = useContacts(jobId);
  const { discoverBatch, isPending: discoverPending, isPolling: discoverPolling } = useDiscoverContacts(jobId);
  const toggleSelection = useToggleContactSelection(jobId);

  const [error, setError] = useState<string | null>(null);
  const bootstrapRef = useRef(false);

  // currentRound preserves legacy data: users mid-flow with round_number > 1
  // continue to see their latest round. New jobs always live in round 1; the
  // round concept is otherwise dead in this UI (no advance path).
  const currentRound = useMemo(() => {
    if (contacts.length === 0) return 1;
    return Math.max(...contacts.map((c) => c.roundNumber ?? 1));
  }, [contacts]);

  const roundContacts = useMemo(
    () => contacts.filter((c) => (c.roundNumber ?? 1) === currentRound),
    [contacts, currentRound]
  );

  const visibleContacts = useMemo(() => {
    const selected = roundContacts.filter((c) => c.isSelected);
    const unselected = roundContacts
      .filter((c) => !c.isSelected)
      .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
    return [...selected, ...unselected];
  }, [roundContacts]);

  const selectedCount = useMemo(
    () => roundContacts.filter((c) => c.isSelected).length,
    [roundContacts]
  );

  const currentBatch = useMemo(() => {
    if (roundContacts.length === 0) return 0;
    return Math.max(...roundContacts.map((c) => c.batchNumber ?? 1));
  }, [roundContacts]);

  const busy = discoverPending || discoverPolling;

  // Auto-trigger first batch when the room opens with no contacts yet.
  useEffect(() => {
    if (bootstrapRef.current) return;
    if (isLoading) return;
    if (contacts.length > 0) return;
    if (busy) return;
    bootstrapRef.current = true;
    setError(null);
    discoverBatch(1, 1);
  }, [isLoading, contacts.length, busy, discoverBatch]);

  const handleToggle = (contact: Contact) => {
    const nextSelected = !contact.isSelected;
    if (nextSelected && selectedCount >= MAX_SELECTIONS) return;
    toggleSelection.mutate({ contactId: contact.id, isSelected: nextSelected });
  };

  const handleRegenerate = () => {
    if (currentBatch >= MAX_BATCHES) return;
    setError(null);
    discoverBatch(currentBatch + 1, currentRound);
  };

  const handleRetry = () => {
    setError(null);
    bootstrapRef.current = false; // allow auto-trigger to fire again
    discoverBatch(1, currentRound);
  };

  const canRegenerate = roundContacts.length < MAX_VISIBLE && currentBatch < MAX_BATCHES && !busy;
  const hideRegenerate = roundContacts.length >= MAX_VISIBLE;
  const canConfirm = selectedCount >= 1 && selectedCount <= MAX_SELECTIONS && !confirming;

  if (isLoading || (contacts.length === 0 && busy)) {
    return <LoadingPanel />;
  }

  if (contacts.length === 0 && !busy) {
    return (
      <ErrorPanel
        message={error ?? "No contacts found yet."}
        actionLabel="Try again"
        onAction={handleRetry}
      />
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-xl font-serif font-semibold text-foreground">Pick your contacts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose contacts to reach out to. {selectedCount}/{MAX_SELECTIONS} selected · {roundContacts.length}/{MAX_VISIBLE} contacts seen
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {visibleContacts.map((c) => (
          <ContactCard
            key={c.id}
            contact={c}
            selected={!!c.isSelected}
            onClick={() => handleToggle(c)}
          />
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {!hideRegenerate && (
          <button
            onClick={handleRegenerate}
            disabled={!canRegenerate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {busy ? "Finding more…" : "Show me different contacts"}
          </button>
        )}

        <div className="flex-1" />

        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Confirm Selection
        </button>
      </div>

      {isFetching && !busy && (
        <p className="text-xs text-muted-foreground text-center">Syncing…</p>
      )}
    </div>
  );
};

const LoadingPanel = () => (
  <EmptyState
    illustration={<RadarSweepIllustration />}
    headline="Finding the right people..."
    body="We're scanning LinkedIn for potential contacts at this company."
  >
    <div className="flex items-center gap-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            animation: "referroing-dot-pulse 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
          className="block w-[5px] h-[5px] rounded-full bg-primary/40"
        />
      ))}
    </div>
  </EmptyState>
);

const ErrorPanel = ({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) => (
  <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
    <AlertCircle className="w-6 h-6 text-muted-foreground" />
    <p className="text-sm text-muted-foreground">{message}</p>
    <button
      onClick={onAction}
      className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
    >
      {actionLabel}
    </button>
  </div>
);

export default PickContactsPanel;
