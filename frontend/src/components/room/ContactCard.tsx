import { useState } from "react";
import { Check, ExternalLink, GraduationCap } from "lucide-react";
import { Contact } from "@/types/job";

interface ContactCardProps {
  contact: Contact;
  selected: boolean;
  locked?: boolean;
  onClick?: () => void;
}

function formatTenure(months?: number): string {
  if (!months || months <= 0) return "";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} mo${rem === 1 ? "" : "s"}`;
  if (rem === 0) return `${years} yr${years === 1 ? "" : "s"}`;
  return `${years} yr${years === 1 ? "" : "s"} ${rem} mo${rem === 1 ? "" : "s"}`;
}

const CONFIDENCE_CLASSES: Record<Contact["confidence"], string> = {
  High: "bg-primary/15 text-primary",
  Medium: "bg-muted text-muted-foreground",
  Low: "bg-muted text-muted-foreground opacity-70",
};

const ContactCard = ({ contact, selected, locked = false, onClick }: ContactCardProps) => {
  const [imgFailed, setImgFailed] = useState(false);
  const monogram = (contact.fullName?.split(" ").map((s) => s[0]).join("").slice(0, 2) || "?").toUpperCase();
  const tenure = formatTenure(contact.tenureMonths);

  const fitBits = [contact.relationship, contact.company && `at ${contact.company}`, tenure]
    .filter(Boolean)
    .join(" · ");

  const canClick = !!onClick && !locked;
  const showPhoto = contact.photoUrl && !imgFailed;

  return (
    <button
      type="button"
      onClick={canClick ? onClick : undefined}
      disabled={!canClick}
      aria-pressed={selected}
      className={`relative flex flex-col gap-4 rounded-2xl border bg-card p-5 text-left transition-all ${
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-muted-foreground/40 hover:shadow-md"
      } ${canClick ? "cursor-pointer" : "cursor-default"}`}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
          <Check className="w-4 h-4" strokeWidth={3} />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center text-base font-semibold text-foreground shrink-0">
          {showPhoto ? (
            <img
              src={contact.photoUrl!}
              alt={contact.fullName}
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            monogram
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate">{contact.fullName || "Unknown"}</p>
          <p className="text-sm text-muted-foreground line-clamp-2">{contact.title || "—"}</p>
        </div>
      </div>

      {fitBits && (
        <p className="text-xs text-muted-foreground line-clamp-2">{fitBits}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONFIDENCE_CLASSES[contact.confidence]}`}>
          {contact.confidence} fit
        </span>
        {contact.university && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"
            title={contact.university}
          >
            <GraduationCap className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[180px]">{contact.university}</span>
          </span>
        )}
      </div>

      {contact.linkedinUrl && (
        <a
          href={contact.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ExternalLink className="w-3 h-3" />
          View on LinkedIn
        </a>
      )}
    </button>
  );
};

export default ContactCard;
