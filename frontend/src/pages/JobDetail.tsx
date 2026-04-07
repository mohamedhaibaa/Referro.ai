import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { JobStatus } from "@/types/job";
import Sidebar from "@/components/Sidebar";
import ProgressTracker from "@/components/job-detail/ProgressTracker";
import ContactDiscovery from "@/components/job-detail/ContactDiscovery";
import OutreachBuilder from "@/components/job-detail/OutreachBuilder";
import FollowUpScheduler from "@/components/job-detail/FollowUpScheduler";
import PitchDeckPanel from "@/components/job-detail/PitchDeckPanel";
import FlashCardsPanel from "@/components/job-detail/FlashCardsPanel";
import NotesAttachments from "@/components/job-detail/NotesAttachments";
import ActivityTimeline from "@/components/job-detail/ActivityTimeline";
import OutcomeSection from "@/components/job-detail/OutcomeSection";
import { useJob, useUpdateJob, useJobMilestones, useUpdateMilestones } from "@/hooks/useJobs";
import { Milestones } from "@/lib/api/jobs";

const statusOptions: JobStatus[] = [
  "Interested",
  "Outreach Ready",
  "Outreach Sent",
  "Replied",
  "Meeting Booked",
  "Interviewing",
  "Offer",
  "Closed",
];

const emptyMilestones: Milestones = {
  resumeTailored: false,
  contactSelected: false,
  outreachSent: false,
  followUpSent: false,
  replyReceived: false,
  interviewScheduled: false,
  interviewPrep1: false,
  interviewPrep2: false,
  interviewPrep3: false,
  outcomeRecorded: false,
};

const JobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: job, isLoading, isError } = useJob(id ?? "");
  const updateJob = useUpdateJob();
  const { data: milestones = emptyMilestones } = useJobMilestones(id);
  const updateMilestones = useUpdateMilestones(id ?? "");

  const [showFullDescription, setShowFullDescription] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Job not found</p>
      </div>
    );
  }

  const calculateProgress = () => {
    const completed = Object.values(milestones).filter(Boolean).length;
    return Math.round((completed / 10) * 100);
  };

  const handleStatusChange = (newStatus: JobStatus) => {
    updateJob.mutate({ id: job.id, patch: { status: newStatus } });
  };

  const toggleMilestone = (key: keyof Milestones) => {
    updateMilestones.mutate({ [key]: !milestones[key] });
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <main className="ml-20 p-8">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="bg-card rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-muted-foreground text-sm mb-1">{job.company}</p>
              <h1 className="text-2xl font-serif font-bold text-foreground mb-3">{job.title}</h1>

              <div className="flex items-center gap-4 mb-4">
                {job.dueDate && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Deadline:</span>
                    <span className="text-sm text-foreground font-medium">{job.dueDate}</span>
                  </div>
                )}
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary text-sm hover:underline"
                >
                  View Job Posting
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Status:</span>
                <select
                  value={job.status}
                  onChange={(e) => handleStatusChange(e.target.value as JobStatus)}
                  className="px-3 py-1.5 rounded-lg bg-muted border border-border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {job.description && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className={`text-sm text-muted-foreground ${!showFullDescription ? "line-clamp-2" : ""}`}>
                {job.description}
              </div>
              <button
                onClick={() => setShowFullDescription(!showFullDescription)}
                className="flex items-center gap-1 text-primary text-sm mt-2 hover:underline"
              >
                {showFullDescription ? "Show less" : "View full"}
                {showFullDescription ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <ProgressTracker
              progress={calculateProgress()}
              milestones={milestones}
              onToggle={toggleMilestone}
            />
            <ContactDiscovery jobId={job.id} />
            <OutreachBuilder />
            <FollowUpScheduler />
            <OutcomeSection />
          </div>

          <div className="space-y-6">
            <PitchDeckPanel />
            <FlashCardsPanel />
            <NotesAttachments tags={job.tags || []} />
            <ActivityTimeline activities={job.activityTimeline || []} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default JobDetail;
