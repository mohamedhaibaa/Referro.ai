import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Briefcase, ArrowRight, Plus } from "lucide-react";
import { Job } from "@/types/job";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface JobsPreviewProps {
  jobs: Job[];
}

const JobsPreview = ({ jobs }: JobsPreviewProps) => {
  // For demo purposes, show recent jobs (in real app, filter by today's date)
  const todayJobs = useMemo(() => {
    return jobs.filter((job) => job.status !== "Closed").slice(0, 3);
  }, [jobs]);

  const getFitColor = (fit: string | undefined | null) => {
    switch (fit) {
      case "High":
        return "bg-green-500/20 text-green-600";
      case "Medium":
        return "bg-amber-500/20 text-amber-600";
      case "Low":
        return "bg-red-500/20 text-red-600";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="bg-card rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-serif font-semibold text-foreground">Jobs Today</h2>
          <Badge variant="secondary" className="text-xs">
            {todayJobs.length} active
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/jobs">
            <Button variant="ghost" size="sm" className="gap-2">
              Go to Jobs
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Job List */}
      {todayJobs.length === 0 ? (
        <div className="py-8 text-center">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
            <Briefcase className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">No jobs yet. Start tracking your applications!</p>
          <Link to="/jobs">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Create Job
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {todayJobs.map((job) => (
            <Link
              key={job.id}
              to={`/job/${job.id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors group"
            >
              {/* Company logo placeholder */}
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-primary">
                  {job.company.charAt(0)}
                </span>
              </div>

              {/* Job info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{job.title}</p>
                <p className="text-xs text-muted-foreground truncate">{job.company}</p>
              </div>

              {/* Fit badge */}
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${getFitColor(job.fitScore)}`}>
                {job.fitScore || "—"}
              </span>

              {/* Status */}
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary shrink-0">
                {job.status}
              </span>
            </Link>
          ))}

          {/* Create Job CTA */}
          <Link to="/jobs" className="block">
            <Button variant="outline" size="sm" className="w-full gap-2 mt-2">
              <Plus className="w-4 h-4" />
              Create Job
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default JobsPreview;
