import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { outcomeLabel, outcomeOptionsForState } from "@/lib/contactLifecycle";

interface OutcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (outcome: string) => void;
  currentStatus: string;
  pending?: boolean;
}

const OutcomeDialog = ({ open, onOpenChange, onConfirm, currentStatus, pending }: OutcomeDialogProps) => {
  const options = outcomeOptionsForState(currentStatus);
  const [choice, setChoice] = useState<string | null>(null);

  // Reset selection whenever the dialog opens or the state changes.
  useEffect(() => {
    if (open) setChoice(null);
  }, [open, currentStatus]);

  const handleConfirm = () => {
    if (!choice) return;
    onConfirm(choice);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[150] bg-background/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-[151] w-full max-w-[440px] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-border bg-card p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-start justify-between mb-1">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
              Record outcome
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="text-sm text-muted-foreground mb-4">
            How did this outreach end?
          </DialogPrimitive.Description>

          <div className="space-y-2 mb-6">
            {options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setChoice(o)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                  choice === o
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-foreground hover:bg-muted"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    choice === o ? "border-primary" : "border-muted-foreground"
                  }`}
                >
                  {choice === o && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </span>
                <span className="text-sm font-medium">{outcomeLabel(o)}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <DialogPrimitive.Close
              className="px-4 py-2 rounded-full text-sm text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </DialogPrimitive.Close>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!choice || pending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default OutcomeDialog;
