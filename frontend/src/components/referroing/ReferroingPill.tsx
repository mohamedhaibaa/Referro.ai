import { useLocation } from "react-router-dom";
import { Loader2, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useReferroing } from "@/contexts/ReferroingContext";

const HIDDEN_PATHS = ["/login", "/signup"];

const ReferroingPill = () => {
  const location = useLocation();
  const {
    activeReferro,
    uiMode,
    status,
    openBlur,
    openActiveRoom,
    clearReferro,
  } = useReferroing();

  if (!activeReferro || uiMode === "blurred" || uiMode === "hidden") return null;
  if (HIDDEN_PATHS.includes(location.pathname)) return null;

  const label = activeReferro.companyName ?? activeReferro.jobTitle ?? "your job";

  const onClick = () => {
    if (status === "completed") openActiveRoom();
    else if (status === "failed") return;
    else openBlur();
  };

  const clickable = status !== "failed";

  return (
    <div className="fixed top-4 right-4 z-[90]">
      <div
        className={`flex items-center gap-2 pl-3 pr-2 py-2 rounded-full border shadow-md text-sm transition-colors ${
          status === "failed"
            ? "bg-destructive/10 border-destructive/40 text-destructive"
            : status === "completed"
            ? "bg-primary/10 border-primary/40 text-primary"
            : "bg-card border-border text-foreground"
        }`}
      >
        <button
          onClick={onClick}
          disabled={!clickable}
          className="flex items-center gap-2 disabled:cursor-default"
        >
          {status === "completed" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : status === "failed" ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
          <span className="font-medium">
            {status === "completed"
              ? `Ready — click to open ${label}`
              : status === "failed"
              ? "Referroing failed"
              : status === "stalled"
              ? `Taking longer than usual — ${label}`
              : `Referroing ${label}...`}
          </span>
        </button>

        {(status === "completed" || status === "failed") && (
          <button
            onClick={clearReferro}
            aria-label="Dismiss"
            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ReferroingPill;
