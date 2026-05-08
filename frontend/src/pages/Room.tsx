import { useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import PickContactsPanel from "@/components/room/PickContactsPanel";
import Phase2Panel from "@/components/room/Phase2Panel";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useJob, useJobMilestones, useUpdateMilestones } from "@/hooks/useJobs";
import { getStagePill, TONE_CLASSES } from "@/lib/jobStagePill";

const Room = () => {
  const { id } = useParams<{ id: string }>();
  const jobId = id ?? "";

  const jobQuery = useJob(jobId);
  const milestonesQuery = useJobMilestones(jobId);
  const job = jobQuery.data;
  const milestones = milestonesQuery.data;
  const updateMilestones = useUpdateMilestones(jobId);
  const [confirming, setConfirming] = useState(false);

  const loading = jobQuery.isLoading || milestonesQuery.isLoading;
  const isError = jobQuery.isError;

  const handleConfirm = () => {
    setConfirming(true);
    updateMilestones.mutate(
      { contactSelected: true },
      {
        onSettled: () => setConfirming(false),
      }
    );
  };

  if (loading) {
    return <Shell><RoomSkeleton /></Shell>;
  }

  if (isError) {
    return (
      <Shell>
        <ErrorState
          headline="Couldn't load this job"
          body="Check your connection and try again."
          onRetry={() => jobQuery.refetch()}
        />
      </Shell>
    );
  }

  if (!job) {
    return (
      <Shell>
        <div className="py-20 text-center">
          <p className="text-muted-foreground mb-4">Job not found.</p>
          <a href="/jobs" className="text-sm text-primary hover:underline">
            Back to Jobs
          </a>
        </div>
      </Shell>
    );
  }

  const pill = getStagePill(job.status, job.contactStatuses);
  const isPhase2 = milestones?.contactSelected === true;

  return (
    <Shell>
      <div className="mb-8">
        <a
          href="/jobs"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to Jobs
        </a>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-serif font-bold text-foreground">
            {job.title || "Untitled"}
          </h1>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${TONE_CLASSES[pill.tone]}`}>
            {pill.label}
          </span>
        </div>
        <p className="text-muted-foreground mt-1">{job.company || "—"}</p>
      </div>

      {isPhase2 ? (
        <Phase2Panel job={job} />
      ) : (
        <PickContactsPanel
          jobId={jobId}
          onConfirm={handleConfirm}
          confirming={confirming}
        />
      )}
    </Shell>
  );
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-background">
    <Sidebar />
    <main className="ml-20 p-8 max-w-6xl">{children}</main>
  </div>
);

const RoomSkeleton = () => (
  <>
    <div className="mb-8 space-y-3">
      <Skeleton className="h-4 w-24" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      <Skeleton className="h-5 w-40" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  </>
);

export default Room;
