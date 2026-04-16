import { User, ExternalLink, Check, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { useContacts, useDiscoverContacts, useRevisitContacts } from "@/hooks/useContacts";

interface ContactDiscoveryProps {
  jobId: string;
}

const confidenceColors = {
  High: "bg-green-100 text-green-700",
  Medium: "bg-yellow-100 text-yellow-700",
  Low: "bg-red-100 text-red-700",
};

const ContactDiscovery = ({ jobId }: ContactDiscoveryProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleBatch, setVisibleBatch] = useState(1);
  const [currentRound, setCurrentRound] = useState(1);
  const [creditError, setCreditError] = useState<string | null>(null);

  const { data: contacts = [], isLoading } = useContacts(jobId);
  const { discoverBatch, isPending, isPolling, hasMore } = useDiscoverContacts(jobId);
  const { mutate: revisit, isPending: isRevisiting, isPolling: isRevisitPolling } = useRevisitContacts(jobId);

  // On load, restore visibleBatch and currentRound to match what's already in the DB
  useEffect(() => {
    if (contacts.length === 0) return;
    const latestRound = Math.max(...contacts.map((c) => c.roundNumber ?? 1));
    const maxBatch = Math.max(
      ...contacts.filter((c) => (c.roundNumber ?? 1) === latestRound).map((c) => c.batchNumber ?? 1)
    );
    setCurrentRound(latestRound);
    setVisibleBatch((prev) => Math.max(prev, maxBatch));
  }, [contacts]);

  const busy = isPending || isPolling;
  const revisitBusy = isRevisiting || isRevisitPolling;

  const visibleContacts = contacts.filter(
    (c) => (c.batchNumber ?? 1) <= visibleBatch && (c.roundNumber ?? 1) === currentRound
  );

  const hasAnyContacts = visibleContacts.length > 0;
  const canShowMore = hasAnyContacts && visibleBatch < 3 && !busy;
  const showRevisit = hasAnyContacts && visibleBatch >= 3 && !revisitBusy;

  const handleDiscover = () => {
    setCreditError(null);
    setVisibleBatch(1);
    discoverBatch(1, currentRound);
  };

  const handleShowMore = () => {
    setCreditError(null);
    const nextBatch = visibleBatch + 1;
    setVisibleBatch(nextBatch);
    discoverBatch(nextBatch, currentRound);
  };

  const handleRevisit = () => {
    setCreditError(null);
    const nextRound = currentRound + 1;
    setCurrentRound(nextRound);
    setVisibleBatch(1);
    revisit(undefined, {
      onError: (err: unknown) => {
        const msg = (err as { message?: string })?.message;
        if (msg?.includes("Insufficient credits") || msg?.includes("402")) {
          setCreditError("Not enough credits. Please top up to find more contacts.");
          setCurrentRound(currentRound); // revert
        }
      },
    });
  };

  return (
    <div className="bg-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-serif font-semibold text-foreground">Who to Reach Out To</h2>
        {!hasAnyContacts && !busy && (
          <button
            onClick={handleDiscover}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Discover Contacts
          </button>
        )}
      </div>

      {creditError && (
        <div className="mb-3 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm">
          {creditError}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : visibleContacts.length > 0 ? (
        <>
          <div className="space-y-3">
            {visibleContacts.map((contact) => (
              <div
                key={contact.id}
                className={`p-4 rounded-xl border transition-all ${
                  selectedId === contact.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{contact.fullName}</p>
                      <p className="text-sm text-muted-foreground">{contact.title}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-foreground">
                          {contact.relationship}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${confidenceColors[contact.confidence]}`}>
                          {contact.confidence} confidence
                        </span>
                        <span className="text-xs text-muted-foreground">
                          via {contact.source}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={contact.linkedinUrl ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-muted rounded-lg transition-colors inline-flex"
                    >
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                    <button
                      onClick={() => setSelectedId(selectedId === contact.id ? null : contact.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedId === contact.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground hover:bg-muted/80"
                      }`}
                    >
                      {selectedId === contact.id ? (
                        <span className="flex items-center gap-1">
                          <Check className="w-3 h-3" /> Selected
                        </span>
                      ) : "Select"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Show more button (batches 2 and 3) */}
          {canShowMore && (
            <button
              onClick={handleShowMore}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Show more contacts
            </button>
          )}

          {busy && (
            <div className="mt-4 flex items-center justify-center gap-2 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Finding more…
            </div>
          )}

          {/* Revisit button (after all 3 batches exhausted) */}
          {showRevisit && (
            <button
              onClick={handleRevisit}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Find 9 more contacts (0.5 credit)
            </button>
          )}

          {revisitBusy && (
            <div className="mt-4 flex items-center justify-center gap-2 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Finding new contacts…
            </div>
          )}
        </>
      ) : busy ? (
        <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          {isPolling ? "Finding contacts…" : "Starting…"}
        </div>
      ) : (
        <div className="p-6 text-center bg-muted/50 rounded-xl">
          <p className="text-muted-foreground">No contacts found — click Discover to find LinkedIn contacts for this role</p>
        </div>
      )}
    </div>
  );
};

export default ContactDiscovery;
