import { ReactNode } from "react";

interface EmptyStateProps {
  illustration?: ReactNode;
  headline: string;
  body?: string;
  cta?: { label: string; onClick: () => void };
  children?: ReactNode;
}

const EmptyState = ({ illustration, headline, body, cta, children }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
    {illustration && (
      <div className="mb-6 text-muted-foreground">{illustration}</div>
    )}
    <h3 className="text-lg font-semibold text-foreground">{headline}</h3>
    {body && (
      <p className="mt-2 text-sm text-muted-foreground max-w-md">{body}</p>
    )}
    {cta && (
      <button
        type="button"
        onClick={cta.onClick}
        className="mt-5 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        {cta.label}
      </button>
    )}
    {children && <div className="mt-5">{children}</div>}
  </div>
);

export default EmptyState;
