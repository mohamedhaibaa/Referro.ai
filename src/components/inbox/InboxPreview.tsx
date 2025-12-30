import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Inbox, ArrowRight } from "lucide-react";
import { Job } from "@/types/job";
import { generateInboxActionsFromJobs } from "@/lib/inboxUtils";
import InboxRow from "./InboxRow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface InboxPreviewProps {
  jobs: Job[];
  onActionComplete?: (actionId: string) => void;
}

const InboxPreview = ({ jobs, onActionComplete }: InboxPreviewProps) => {
  const actions = useMemo(() => generateInboxActionsFromJobs(jobs), [jobs]);
  const activeActions = actions.filter((a) => !a.isCompleted && !a.isSnoozed);
  const topActions = activeActions.slice(0, 3);

  const handleMarkDone = (actionId: string) => {
    onActionComplete?.(actionId);
  };

  const handleSnooze = (actionId: string) => {
    console.log("Snoozed:", actionId);
  };

  return (
    <div className="bg-card rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-serif font-semibold text-foreground">Inbox</h2>
          <Badge variant="secondary" className="text-xs">
            {activeActions.length} actions
          </Badge>
        </div>
        <Link to="/inbox">
          <Button variant="ghost" size="sm" className="gap-2">
            Go to Inbox
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* Preview List */}
      {topActions.length === 0 ? (
        <div className="py-8 text-center">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
            <Inbox className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-1">
          {topActions.map((action) => (
            <InboxRow
              key={action.id}
              action={action}
              onMarkDone={handleMarkDone}
              onSnooze={handleSnooze}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default InboxPreview;
