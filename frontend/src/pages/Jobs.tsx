import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import { sampleJobs } from "@/data/jobs";
import { Job } from "@/types/job";

const Jobs = () => {
  const [jobs, setJobs] = useState<Job[]>(sampleJobs);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <main className="ml-20 p-8">
        <Header />

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-serif font-bold text-foreground">Jobs</h2>
        </div>

        <KanbanBoard jobs={jobs} onJobsChange={setJobs} />
      </main>
    </div>
  );
};

export default Jobs;
