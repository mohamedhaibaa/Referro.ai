import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { useReferroing } from "@/contexts/ReferroingContext";

const WORD = "Referroing";
const LETTER_STAGGER_MS = 80;

const STAGES_BY_PHASE = {
  parsing: ["Scraping job…", "Parsing details…", "Finding your company…"],
  discovery: ["Finding your contacts…", "Ranking by fit…", "Almost there…"],
} as const;
const STAGE_CYCLE_S = 7.5;

const HIDDEN_PATHS = ["/login", "/signup"];

const ReferroingOverlay = () => {
  const location = useLocation();
  const { activeReferro, uiMode, status, phase, errorMessage, clearReferro, dismissBlur } = useReferroing();
  const stages = STAGES_BY_PHASE[phase];
  const stageStepS = STAGE_CYCLE_S / stages.length;

  if (!activeReferro || uiMode !== "blurred") return null;
  if (HIDDEN_PATHS.includes(location.pathname)) return null;

  const isFailed = status === "failed";

  return (
    <div className="fixed left-20 top-0 right-0 bottom-0 z-[100] backdrop-blur-lg bg-background/70">
      {isFailed ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 px-8 py-10 rounded-3xl bg-card border border-border shadow-xl max-w-md w-full mx-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="w-6 h-6 text-destructive" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold text-foreground">Referroing failed</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            </div>
            <button
              onClick={clearReferro}
              className="px-4 py-2 text-sm rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-8">
            <h1 className="text-8xl font-serif font-normal text-foreground select-none" aria-label="Referroing">
              {WORD.split("").map((ch, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  style={{
                    animationDelay: `${i * LETTER_STAGGER_MS}ms`,
                    animation: "referroing-letter-loop 4s ease-in-out infinite",
                  }}
                  className="inline-block opacity-0"
                >
                  {ch}
                </span>
              ))}
            </h1>

            <div key={phase} className="relative h-6 w-72 text-center">
              {stages.map((stage, i) => (
                <span
                  key={stage}
                  style={{
                    animation: `referroing-stage-fade ${STAGE_CYCLE_S}s ease-in-out infinite`,
                    animationDelay: `${i * stageStepS}s`,
                  }}
                  className="absolute inset-0 text-sm text-muted-foreground opacity-0"
                >
                  {status === "stalled" ? "Taking longer than usual…" : stage}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-1.5" aria-hidden="true">
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
          </div>

          <button
            onClick={dismissBlur}
            className="absolute bottom-8 right-8 text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4 transition-colors"
          >
            keep working →
          </button>
        </>
      )}
    </div>
  );
};

export default ReferroingOverlay;
