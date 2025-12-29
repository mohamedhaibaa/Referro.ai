import { CheckSquare } from "lucide-react";

interface TasksCardProps {
  totalTasks: number;
  completedTasks: number;
}

const TasksCard = ({ totalTasks, completedTasks }: TasksCardProps) => {
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="card-pink rounded-2xl p-5 relative overflow-hidden">
      <div className="flex items-start justify-between mb-6">
        <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card/80 text-foreground">
          Today's Tasks
        </span>
        <CheckSquare className="w-5 h-5 text-foreground/60" />
      </div>

      <h3 className="text-lg font-semibold text-foreground leading-tight mb-4">
        Tasks to Complete
      </h3>

      <div className="flex items-end justify-between mb-3">
        <div className="text-4xl font-bold text-foreground">
          {completedTasks}<span className="text-xl text-foreground/60">/{totalTasks}</span>
        </div>
      </div>

      <div className="w-full h-2 bg-foreground/10 rounded-full overflow-hidden">
        <div
          className="h-full progress-pink rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-xs text-foreground/60 mt-2">
        {totalTasks - completedTasks} tasks remaining
      </p>
    </div>
  );
};

export default TasksCard;
