import { AlertCircle } from "lucide-react";

interface ErrorStateProps {
  headline: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
}

const ErrorState = ({ headline, body, onRetry, retryLabel = "Try again", compact = false }: ErrorStateProps) => {
  if (compact) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-destructive/5 px-4 py-3">
        <AlertCircle className="w-4 h-4 shrink-0 text-destructive/70 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{headline}</p>
          {body && <p className="text-xs text-muted-foreground mt-0.5">{body}</p>}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-primary hover:underline underline-offset-2 shrink-0"
          >
            {retryLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-destructive/5 ring-1 ring-destructive/15 flex items-center justify-center mb-6">
        <AlertCircle className="w-10 h-10 text-destructive/70" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{headline}</h3>
      {body && <p className="mt-2 text-sm text-muted-foreground max-w-md">{body}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
};

export default ErrorState;
