import { Target } from "lucide-react";

interface DailyGoalCardProps {
  goal: number;
  completed: number;
}

const DailyGoalCard = ({ goal, completed }: DailyGoalCardProps) => {
  const progress = Math.round((completed / goal) * 100);

  return (
    <div className="card-yellow rounded-2xl p-5 relative overflow-hidden">
      <div className="flex items-start justify-between mb-6">
        <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card/80 text-foreground">
          Daily Goal
        </span>
        <Target className="w-5 h-5 text-foreground/60" />
      </div>

      <h3 className="text-lg font-semibold text-foreground leading-tight mb-4">
        Jobs to Apply Today
      </h3>

      <div className="flex items-end justify-between mb-3">
        <div className="text-4xl font-bold text-foreground">
          {completed}<span className="text-xl text-foreground/60">/{goal}</span>
        </div>
      </div>

      <div className="w-full h-2 bg-foreground/10 rounded-full overflow-hidden">
        <div
          className="h-full progress-yellow rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-xs text-foreground/60 mt-2">
        {goal - completed} more to reach your goal
      </p>
    </div>
  );
};

export default DailyGoalCard;
