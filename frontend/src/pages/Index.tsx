import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import DailyGoalCard from "@/components/DailyGoalCard";
import MetricsCard from "@/components/MetricsCard";
import TasksCard from "@/components/TasksCard";
import InboxPreview from "@/components/inbox/InboxPreview";
import JobsPreview from "@/components/jobs/JobsPreview";
import { useJobs } from "@/hooks/useJobs";
import { useDashboard } from "@/hooks/useDashboard";

const Index = () => {
  const { data: jobs = [] } = useJobs();
  const { data: stats } = useDashboard();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <main className="ml-20 p-8">
        <Header />

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-serif font-bold text-foreground">Dashboard</h2>
        </div>

        <div className="grid grid-cols-3 gap-5 mb-6">
          <DailyGoalCard goal={5} completed={stats?.totalJobs ?? 0} />
          <MetricsCard coffeeChats={stats?.meetings ?? 0} interviews={stats?.offers ?? 0} />
          <TasksCard totalTasks={stats?.totalJobs ?? 0} completedTasks={stats?.outreachSent ?? 0} />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <InboxPreview jobs={jobs} />
          <JobsPreview jobs={jobs} />
        </div>
      </main>
    </div>
  );
};

export default Index;
