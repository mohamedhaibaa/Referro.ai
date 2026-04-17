import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { Contact } from "@/types/job";
import ContactCard from "./ContactCard";
import { useContacts, useDiscoverContacts, useRevisitContacts } from "@/hooks/useContacts";
import { useToggleContactSelection } from "@/hooks/useContactSelection";

interface PickContactsPanelProps {
  jobId: string;
  onConfirm: () => void;
  confirming: boolean;
}

const MAX_BATCHES_PER_ROUND = 3;
const MAX_CONTACTS_PER_ROUND = 9;
const VISIBLE_SLOTS = 3;

const PickContactsPanel = ({ jobId, onConfirm, confirming }: PickContactsPanelProps) => {
  const { data: contacts = [], isLoading, isFetching } = useContacts(jobId);
  const { discoverBatch, isPending: discoverPending, isPolling: discoverPolling } = useDiscoverContacts(jobId);
  const { mutate: revisit, isPending: revisitPending, isPolling: revisitPolling } = useRevisitContacts(jobId);
  const toggleSelection = useToggleContactSelection(jobId);

  const [error, setError] = useState<string | null>(null);
  const bootstrapRef = useRef(false);

  const currentRound = useMemo(() => {
    if (contacts.length === 0) return 1;
    return Math.max(...contacts.map((c) => c.roundNumber ?? 1));
  }, [contacts]);

  const roundContacts = useMemo(
    () => contacts.filter((c) => (c.roundNumber ?? 1) === currentRound),
    [contacts, currentRound]
  );

  const selected = useMemo(() => roundContacts.filter((c) => c.isSelected), [roundContacts]);
  const unselected = useMemo(
    () =>
      roundContacts
        .filter((c) => !c.isSelected)
        .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0)),
    [roundContacts]
  );

  const currentBatch = useMemo(() => {
    if (roundContacts.length === 0) return 0;
    return Math.max(...roundContacts.map((c) => c.batchNumber ?? 1));
  }, [roundContacts]);

  const busy = discoverPending || discoverPolling;
  const revisitBusy = revisitPending || revisitPolling;

  const visible: (Contact | null)[] = useMemo(() => {
    const slots: (Contact | null)[] = [...selected];
    const needed = VISIBLE_SLOTS - slots.length;
    for (let i = 0; i < needed; i++) slots.push(unselected[i] ?? null);
    return slots;
  }, [selected, unselected]);

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
    if (nextSelected && selected.length >= VISIBLE_SLOTS) return;
    toggleSelection.mutate({ contactId: contact.id, isSelected: nextSelected });
  };

  const handleRegenerate = () => {
    if (currentBatch >= MAX_BATCHES_PER_ROUND) return;
    setError(null);
    discoverBatch(currentBatch + 1, currentRound);
  };

  const handleRevisit = () => {
    if (revisitBusy) return;
    setError(null);
    revisit(undefined, {
      onError: (err: unknown) => {
        const msg = (err as { message?: string })?.message ?? "";
        if (msg.includes("Insufficient credits") || msg.includes("402")) {
          setError("Not enough credits to find more contacts.");
        } else {
          setError("Could not start a new round. Try again.");
        }
      },
    });
  };

  const handleRetry = () => {
    setError(null);
    bootstrapRef.current = false; // allow auto-trigger to fire again
    discoverBatch(1, currentRound);
  };

  const canRegenerate = roundContacts.length < MAX_CONTACTS_PER_ROUND && currentBatch < MAX_BATCHES_PER_ROUND && !busy;
  const poolExhausted = currentBatch >= MAX_BATCHES_PER_ROUND;
  const canConfirm = selected.length === VISIBLE_SLOTS && !confirming;
  const hideRegenerate = selected.length >= VISIBLE_SLOTS || roundContacts.length >= MAX_CONTACTS_PER_ROUND;

  // Loading & bootstrap states
  if (isLoading || (contacts.length === 0 && busy)) {
    return <LoadingPanel label="Finding your contacts…" />;
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
            Choose 3 people to reach out to. {selected.length}/3 selected · {roundContacts.length}/{MAX_CONTACTS_PER_ROUND} contacts seen this round
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {visible.map((c, i) =>
          c ? (
            <ContactCard
              key={c.id}
              contact={c}
              selected={!!c.isSelected}
              onClick={() => handleToggle(c)}
            />
          ) : (
            <EmptySlot key={`slot-${i}`} busy={busy} />
          )
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {!hideRegenerate && !poolExhausted && (
          <button
            onClick={handleRegenerate}
            disabled={!canRegenerate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {busy ? "Finding more…" : "Show me different contacts"}
          </button>
        )}
        {poolExhausted && selected.length < VISIBLE_SLOTS && (
          <button
            onClick={handleRevisit}
            disabled={revisitBusy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {revisitBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {revisitBusy ? "Finding new contacts…" : "Find 9 more (0.5 credits)"}
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

const LoadingPanel = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center gap-6 py-20">
    <div className="flex items-center gap-1.5">
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
    <p className="text-sm text-muted-foreground">{label}</p>
  </div>
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

const EmptySlot = ({ busy }: { busy: boolean }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-5 min-h-[200px]">
    {busy ? (
      <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
    ) : (
      <p className="text-xs text-muted-foreground text-center">Regenerate to fill this slot</p>
    )}
  </div>
);

export default PickContactsPanel;
