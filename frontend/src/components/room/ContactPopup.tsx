import { useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { Contact, Job } from "@/types/job";
import { setContactRepliedAt } from "@/lib/api/contacts";
import { useContactOutreach, useDeleteOutreach, useUpdateOutreach } from "@/hooks/useOutreach";
import { STATES, statusLabel } from "@/lib/contactLifecycle";
import StateTimeline from "./StateTimeline";
import MessageDraftView from "./MessageDraftView";

interface ContactPopupProps {
  job: Job;
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ContactPopup = ({ job, contact, open, onOpenChange }: ContactPopupProps) => {
  const qc = useQueryClient();
  const [imgFailed, setImgFailed] = useState(false);

  const { data: messages = [] } = useContactOutreach(job.id, contact?.id ?? "", !!contact);
  const updateOutreach = useUpdateOutreach(job.id, contact?.id ?? "");
  const deleteOutreach = useDeleteOutreach(job.id, contact?.id ?? "");

  const setReplied = useMutation({
    mutationFn: (repliedAt: string | null) =>
      setContactRepliedAt(job.id, contact!.id, repliedAt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", job.id] });
      qc.invalidateQueries({ queryKey: ["outreach", job.id, contact?.id] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Could not update contact";
      toast.error(msg);
    },
  });

  const status = contact?.lifecycleStatus ?? STATES.NOT_CONTACTED;
  const monogram = useMemo(() => {
    if (!contact?.fullName) return "?";
    return contact.fullName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  }, [contact?.fullName]);

  const showPhoto = contact?.photoUrl && !imgFailed;

  const handleMarkReplied = () => {
    setReplied.mutate(new Date().toISOString());
  };

  const handleUndo = () => {
    if (!contact) return;

    if (status === STATES.REPLIED) {
      setReplied.mutate(null);
      return;
    }

    const findMessage = (type: string) => messages.find((m) => m.type === type);
    let targetType: string | null = null;
    let action: "delete" | "unsend" = "delete";

    if (status === STATES.DRAFTED) { targetType = "initial"; action = "delete"; }
    else if (status === STATES.SENT) { targetType = "initial"; action = "unsend"; }
    else if (status === STATES.FOLLOWUP_1_DRAFTED) { targetType = "followup_1"; action = "delete"; }
    else if (status === STATES.FOLLOWUP_1_SENT) { targetType = "followup_1"; action = "unsend"; }
    else if (status === STATES.FOLLOWUP_2_DRAFTED) { targetType = "followup_2"; action = "delete"; }
    else if (status === STATES.FOLLOWUP_2_SENT) { targetType = "followup_2"; action = "unsend"; }

    if (!targetType) return;
    const target = findMessage(targetType);
    if (!target) {
      toast.error("Nothing to undo");
      return;
    }

    if (action === "delete") {
      deleteOutreach.mutate(target.id);
    } else {
      updateOutreach.mutate({
        outreachId: target.id,
        patch: { sent_at: null },
      });
    }
  };

  if (!contact) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed left-20 top-0 right-0 bottom-0 z-[100] backdrop-blur-lg bg-background/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className="fixed left-[calc(50%+2.5rem)] top-[50%] z-[101] w-full max-w-[640px] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-border bg-card shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 overflow-hidden"
        >
          <div className="p-6 pb-4 border-b border-border">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-muted flex items-center justify-center text-lg font-semibold text-foreground shrink-0">
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
                <DialogPrimitive.Title className="text-lg font-semibold text-foreground truncate text-left">
                  {contact.fullName}
                </DialogPrimitive.Title>
                <p className="text-sm text-muted-foreground truncate text-left">{contact.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 text-left">{statusLabel(status)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {contact.linkedinUrl && (
                  <a
                    href={contact.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Open LinkedIn"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <DialogPrimitive.Close
                  className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </DialogPrimitive.Close>
              </div>
            </div>
            <div className="pt-4">
              <StateTimeline status={status} />
            </div>
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto">
            <MessageDraftView
              job={job}
              contact={contact}
              messages={messages}
              onMarkReplied={handleMarkReplied}
              onUndo={handleUndo}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default ContactPopup;
