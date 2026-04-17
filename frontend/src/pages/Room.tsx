import { useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import PickContactsPanel from "@/components/room/PickContactsPanel";
import Phase2Panel from "@/components/room/Phase2Panel";
import { useJob, useJobMilestones, useUpdateMilestones } from "@/hooks/useJobs";
import { getStagePill, TONE_CLASSES } from "@/lib/jobStagePill";

const Room = () => {
  const { id } = useParams<{ id: string }>();
  const jobId = id ?? "";

  const { data: job, isLoading: jobLoading } = useJob(jobId);
  const { data: milestones, isLoading: milestonesLoading } = useJobMilestones(jobId);
  const updateMilestones = useUpdateMilestones(jobId);
  const [confirming, setConfirming] = useState(false);

  const loading = jobLoading || milestonesLoading;

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
    return <Shell><CenteredSpinner /></Shell>;
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

  const pill = getStagePill(job.status);
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

const CenteredSpinner = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
  </div>
);

export default Room;
