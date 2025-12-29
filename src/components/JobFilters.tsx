import { JobStatus } from "@/types/job";

const filters: (JobStatus | "All")[] = [
  "All",
  "Interested",
  "Outreach Ready",
  "Outreach Sent",
  "Replied",
  "Meeting Booked",
  "Interviewing",
  "Offer",
  "Closed",
];

interface JobFiltersProps {
  active: JobStatus | "All";
  onChange: (filter: JobStatus | "All") => void;
}

const JobFilters = ({ active, onChange }: JobFiltersProps) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {filters.map((filter) => (
        <button
          key={filter}
          onClick={() => onChange(filter)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
            active === filter
              ? "bg-foreground text-background"
              : "bg-card border border-border text-foreground hover:bg-muted"
          }`}
        >
          {filter}
        </button>
      ))}
    </div>
  );
};

export default JobFilters;
