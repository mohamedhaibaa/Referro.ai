import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import { useJobs, useUpdateJob } from "@/hooks/useJobs";
import { Job } from "@/types/job";

const Jobs = () => {
  const { data: jobs = [], isLoading } = useJobs();
  const updateJob = useUpdateJob();

  function handleJobsChange(updatedJobs: Job[]) {
    updatedJobs.forEach((updatedJob) => {
      const prev = jobs.find((j) => j.id === updatedJob.id);
      if (prev && prev.status !== updatedJob.status) {
        updateJob.mutate({ id: updatedJob.id, patch: { status: updatedJob.status } });
      }
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <main className="ml-20 p-8">
        <Header />

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-serif font-bold text-foreground">Jobs</h2>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-sm py-8">Loading jobs...</div>
        ) : (
          <KanbanBoard jobs={jobs} onJobsChange={handleJobsChange} />
        )}
      </main>
    </div>
  );
};

export default Jobs;
