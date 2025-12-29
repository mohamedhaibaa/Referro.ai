import { Circle } from "lucide-react";
import { ActivityItem } from "@/types/job";

interface ActivityTimelineProps {
  activities: ActivityItem[];
}

const ActivityTimeline = ({ activities }: ActivityTimelineProps) => {
  return (
    <div className="bg-card rounded-2xl p-6">
      <h2 className="text-lg font-serif font-semibold text-foreground mb-4">Activity Timeline</h2>
      
      {activities.length > 0 ? (
        <div className="space-y-3">
          {activities.map((activity, i) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <Circle className="w-3 h-3 text-primary fill-primary" />
                {i < activities.length - 1 && (
                  <div className="w-0.5 h-6 bg-border" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-foreground">{activity.action}</p>
                <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
      )}
    </div>
  );
};

export default ActivityTimeline;
