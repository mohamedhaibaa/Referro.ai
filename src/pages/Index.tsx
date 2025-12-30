import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import DailyGoalCard from "@/components/DailyGoalCard";
import MetricsCard from "@/components/MetricsCard";
import TasksCard from "@/components/TasksCard";
import InboxPreview from "@/components/inbox/InboxPreview";
import { sampleJobs } from "@/data/jobs";
import { Job } from "@/types/job";

const Index = () => {
  const [jobs] = useState<Job[]>(sampleJobs);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <main className="ml-20 p-8">
        <Header />

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-serif font-bold text-foreground">Dashboard</h2>
        </div>

        <div className="grid grid-cols-3 gap-5 mb-6">
          <DailyGoalCard goal={5} completed={2} />
          <MetricsCard coffeeChats={8} interviews={3} />
          <TasksCard totalTasks={12} completedTasks={7} />
        </div>

        <InboxPreview jobs={jobs} />
      </main>
    </div>
  );
};

export default Index;
