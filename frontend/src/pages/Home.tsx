import { useState, FormEvent } from "react";
import { ArrowRight, Link as LinkIcon, Zap } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useCreateJob, useJobs } from "@/hooks/useJobs";
import { useReferroing } from "@/contexts/ReferroingContext";

function isLikelyUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return !!u.hostname && u.hostname.includes(".");
  } catch {
    return false;
  }
}

const Home = () => {
  const { user } = useAuth();
  const { data: credits } = useCredits();
  const { data: jobs = [] } = useJobs();
  const createJob = useCreateJob();
  const { startReferro, isActive } = useReferroing();

  const [url, setUrl] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const firstName = user?.name?.split(" ")[0];
  const greeting = firstName ? `Welcome back, ${firstName}` : "Welcome";
  const isFirstTime = jobs.length === 0;

  const disabled = isActive || createJob.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmed = url.trim();
    if (!isLikelyUrl(trimmed)) {
      setLocalError("Please paste a valid URL.");
      return;
    }

    createJob.mutate(
      { url: trimmed },
      {
        onSuccess: (job) => {
          if (!job.workflowRunId) {
            setLocalError("Job created, but no workflow was triggered. Try refreshing.");
            return;
          }
          startReferro({
            jobId: job.id,
            workflowRunId: job.workflowRunId,
            jobTitle: job.title || undefined,
            companyName: job.company || undefined,
          });
          setUrl("");
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Something went wrong.";
          setLocalError(msg);
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <main className="ml-20 min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-2xl flex flex-col items-center gap-6">
          <h1 className="text-4xl font-serif font-bold text-foreground text-center">
            {greeting}
          </h1>

          <p className="text-muted-foreground text-center">
            Paste a job URL to start a new Referro.
          </p>

          <form
            onSubmit={handleSubmit}
            className={`w-full flex items-center gap-2 p-2 pl-4 rounded-2xl border bg-card transition-all ${
              disabled ? "opacity-60" : ""
            }`}
            title={isActive ? "One at a time" : undefined}
          >
            <LinkIcon className="w-5 h-5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://company.com/jobs/..."
              disabled={disabled}
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={disabled || !url.trim()}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="text-sm font-medium">Enter</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {localError && (
            <p className="text-sm text-destructive">{localError}</p>
          )}

          {credits && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span>
                {credits.creditsRemaining % 1 === 0
                  ? credits.creditsRemaining.toFixed(0)
                  : credits.creditsRemaining.toFixed(1)}{" "}
                credits remaining
              </span>
            </div>
          )}

          {isFirstTime && (
            <div className="mt-4 text-xs text-muted-foreground text-center max-w-md">
              First time here? Paste a LinkedIn job URL or a company careers page. We'll
              parse the job, find the right contacts, and set up your outreach.
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Home;
