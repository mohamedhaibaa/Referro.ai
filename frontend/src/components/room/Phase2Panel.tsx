import { useMemo, useState } from "react";
import { Contact, Job } from "@/types/job";
import { useContacts } from "@/hooks/useContacts";
import { STATES, shortStatusBadge } from "@/lib/contactLifecycle";
import ContactPopup from "./ContactPopup";

interface Phase2PanelProps {
  job: Job;
}

function statusBadgeClasses(status: string): string {
  if (status === STATES.NOT_CONTACTED) return "bg-muted text-muted-foreground";
  if (status === STATES.DRAFTED || status === STATES.FOLLOWUP_1_DRAFTED || status === STATES.FOLLOWUP_2_DRAFTED) {
    return "bg-muted text-foreground";
  }
  if (status === STATES.SENT || status === STATES.FOLLOWUP_1_SENT || status === STATES.FOLLOWUP_2_SENT) {
    return "bg-primary/10 text-primary";
  }
  if (status === STATES.REPLIED) return "bg-[hsl(var(--card-yellow))] text-foreground";
  return "bg-muted text-muted-foreground";
}

const Phase2Panel = ({ job }: Phase2PanelProps) => {
  const { data: contacts = [] } = useContacts(job.id);
  const [openContactId, setOpenContactId] = useState<string | null>(null);

  const selected = useMemo(
    () => contacts.filter((c) => c.isSelected),
    [contacts]
  );

  const openContact = useMemo(
    () => (openContactId ? selected.find((c) => c.id === openContactId) ?? null : null),
    [openContactId, selected]
  );

  const sentCount = selected.filter((c) =>
    c.lifecycleStatus && c.lifecycleStatus !== STATES.NOT_CONTACTED && c.lifecycleStatus !== STATES.DRAFTED
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-serif font-semibold text-foreground">Reach out</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Click a contact to draft and track your outreach. {sentCount}/{selected.length} contacted.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {selected.map((c) => (
          <ContactTile key={c.id} contact={c} onClick={() => setOpenContactId(c.id)} />
        ))}
      </div>

      <ContactPopup
        job={job}
        contact={openContact}
        open={!!openContact}
        onOpenChange={(o) => !o && setOpenContactId(null)}
      />
    </div>
  );
};

interface ContactTileProps {
  contact: Contact;
  onClick: () => void;
}

const ContactTile = ({ contact, onClick }: ContactTileProps) => {
  const status = contact.lifecycleStatus ?? STATES.NOT_CONTACTED;
  const monogram = (contact.fullName?.split(" ").map((s) => s[0]).join("").slice(0, 2) || "?").toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left hover:border-muted-foreground/40 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center text-base font-semibold text-foreground shrink-0">
          {contact.photoUrl ? (
            <img src={contact.photoUrl} alt={contact.fullName} className="w-full h-full object-cover" />
          ) : (
            monogram
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate">{contact.fullName || "Unknown"}</p>
          <p className="text-sm text-muted-foreground line-clamp-2">{contact.title || "—"}</p>
        </div>
      </div>

      <div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadgeClasses(status)}`}>
          {shortStatusBadge(status)}
        </span>
      </div>
    </button>
  );
};

export default Phase2Panel;
