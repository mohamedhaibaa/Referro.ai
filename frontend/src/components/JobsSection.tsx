import { useState } from "react";
import { Plus, Link, X } from "lucide-react";
import JobFilters from "./JobFilters";
import JobRow from "./JobRow";
import { Job, JobStatus } from "@/types/job";

interface JobsSectionProps {
  jobs: Job[];
}

const JobsSection = ({ jobs }: JobsSectionProps) => {
  const [activeFilter, setActiveFilter] = useState<JobStatus | "All">("All");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [jobUrl, setJobUrl] = useState("");

  const filteredJobs = activeFilter === "All" 
    ? jobs 
    : jobs.filter(job => job.status === activeFilter);

  const handleCreateJob = () => {
    if (jobUrl.trim()) {
      console.log("Creating job from URL:", jobUrl);
      setJobUrl("");
      setShowUrlInput(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-serif font-semibold text-foreground">Jobs Created</h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Job
          </button>
        </div>
      </div>

      {/* URL Input - Smooth transition */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showUrlInput ? 'max-h-20 opacity-100 mb-4' : 'max-h-0 opacity-0'}`}>
        <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
          <Link className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            type="url"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            placeholder="Paste job posting URL here..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
            autoFocus
          />
          <button
            onClick={handleCreateJob}
            className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Add
          </button>
          <button
            onClick={() => setShowUrlInput(false)}
            className="p-1.5 hover:bg-background rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="mb-4">
        <JobFilters active={activeFilter} onChange={setActiveFilter} />
      </div>

      <div className="flex items-center py-3 text-xs text-muted-foreground uppercase tracking-wider">
        <div className="flex-1">Job Title</div>
        <div className="w-40">Company</div>
        <div className="w-32">Due Date</div>
        <div className="w-32 text-right">Status</div>
      </div>

      {filteredJobs.length > 0 ? (
        filteredJobs.map((job) => (
          <JobRow 
            key={job.id} 
            id={job.id}
            title={job.title}
            company={job.company}
            dueDate={job.dueDate}
            status={job.status}
          />
        ))
      ) : (
        <div className="py-8 text-center text-muted-foreground">
          No jobs found with this status
        </div>
      )}
    </div>
  );
};

export default JobsSection;
