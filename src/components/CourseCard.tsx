import { Bookmark } from "lucide-react";
import AvatarGroup from "./AvatarGroup";

interface CourseCardProps {
  category: string;
  title: string;
  progress: number;
  totalLessons: number;
  completedLessons: number;
  variant: "yellow" | "lavender" | "pink";
  avatars: string[];
  studentCount: number;
  bookmarked?: boolean;
}

const CourseCard = ({
  category,
  title,
  progress,
  totalLessons,
  completedLessons,
  variant,
  avatars,
  studentCount,
  bookmarked = false,
}: CourseCardProps) => {
  const variantClasses = {
    yellow: "card-yellow",
    lavender: "card-lavender",
    pink: "card-pink",
  };

  const progressClasses = {
    yellow: "progress-yellow",
    lavender: "progress-lavender",
    pink: "progress-pink",
  };

  const categoryColors = {
    yellow: "bg-foreground text-background",
    lavender: "bg-foreground text-background",
    pink: "bg-card text-foreground border border-border",
  };

  return (
    <div className={`${variantClasses[variant]} rounded-2xl p-5 flex flex-col h-full`}>
      <div className="flex items-start justify-between mb-4">
        <span className={`px-3 py-1.5 rounded-lg text-xs font-medium ${categoryColors[variant]}`}>
          {category}
        </span>
        <button className="text-foreground hover:text-primary transition-colors">
          <Bookmark size={22} fill={bookmarked ? "currentColor" : "none"} />
        </button>
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-auto leading-tight">
        {title}
      </h3>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-foreground/80">Progress</span>
          <span className="text-sm text-foreground/80">
            {completedLessons}/{totalLessons} lessons
          </span>
        </div>
        <div className="h-2 bg-foreground/10 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressClasses[variant]} rounded-full transition-all`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-5">
        <AvatarGroup avatars={avatars} count={studentCount} />
        <button className="px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors">
          Continue
        </button>
      </div>
    </div>
  );
};

export default CourseCard;
