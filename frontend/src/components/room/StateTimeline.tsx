import { Check } from "lucide-react";
import { TIMELINE_STEPS, timelineIndex } from "@/lib/contactLifecycle";

interface StateTimelineProps {
  status: string;
}

const StateTimeline = ({ status }: StateTimelineProps) => {
  const currentIdx = timelineIndex(status);

  return (
    <div className="flex items-center gap-1">
      {TIMELINE_STEPS.map((step, i) => {
        const isPast = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-1 flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                  isPast
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                    ? "bg-primary/20 text-primary ring-2 ring-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isPast ? (
                  <Check className="w-3 h-3" strokeWidth={3} />
                ) : (
                  <span className="text-[10px] font-semibold">{i + 1}</span>
                )}
              </div>
              <span
                className={`text-[10px] whitespace-nowrap ${
                  isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div
                className={`h-[1px] flex-1 mb-4 ${
                  isPast ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StateTimeline;
