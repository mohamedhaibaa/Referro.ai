import { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Filter,
  LayoutGrid,
  List,
  Link,
  X,
  ChevronDown,
} from "lucide-react";
import { Job, JobStatus, PIPELINE_STAGES } from "@/types/job";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import KanbanColumn from "./KanbanColumn";
import KanbanFilters, { FilterState } from "./KanbanFilters";
import { cn } from "@/lib/utils";

interface KanbanBoardProps {
  jobs: Job[];
  onJobsChange?: (jobs: Job[]) => void;
}

const KanbanBoard = ({ jobs, onJobsChange }: KanbanBoardProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [jobUrl, setJobUrl] = useState("");
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [wipLimits, setWipLimits] = useState<Partial<Record<JobStatus, number>>>(
    {}
  );

  const [filters, setFilters] = useState<FilterState>({
    roleFamily: [],
    workMode: [],
    fitScore: [],
    company: "",
    tags: [],
    status: [],
  });

  // Extract all unique tags from jobs
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    jobs.forEach((job) => {
      job.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags);
  }, [jobs]);

  // Filter and search jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          job.title.toLowerCase().includes(query) ||
          job.company.toLowerCase().includes(query) ||
          job.tags?.some((tag) => tag.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Role Family
      if (
        filters.roleFamily.length > 0 &&
        (!job.roleFamily || !filters.roleFamily.includes(job.roleFamily))
      ) {
        return false;
      }

      // Work Mode
      if (
        filters.workMode.length > 0 &&
        (!job.workMode || !filters.workMode.includes(job.workMode))
      ) {
        return false;
      }

      // Fit Score
      if (
        filters.fitScore.length > 0 &&
        (!job.fitScore || !filters.fitScore.includes(job.fitScore))
      ) {
        return false;
      }

      // Company
      if (
        filters.company &&
        !job.company.toLowerCase().includes(filters.company.toLowerCase())
      ) {
        return false;
      }

      // Tags
      if (
        filters.tags.length > 0 &&
        !filters.tags.some((tag) => job.tags?.includes(tag))
      ) {
        return false;
      }

      // Status
      if (filters.status.length > 0 && !filters.status.includes(job.status)) {
        return false;
      }

      return true;
    });
  }, [jobs, searchQuery, filters]);

  // Group jobs by status
  const jobsByStatus = useMemo(() => {
    const grouped: Record<JobStatus, Job[]> = {
      Interested: [],
      "Outreach Ready": [],
      "Outreach Sent": [],
      Replied: [],
      "Meeting Booked": [],
      Interviewing: [],
      Offer: [],
      Closed: [],
    };

    filteredJobs.forEach((job) => {
      grouped[job.status].push(job);
    });

    return grouped;
  }, [filteredJobs]);

  const handleCreateJob = () => {
    if (jobUrl.trim()) {
      console.log("Creating job from URL:", jobUrl);
      setJobUrl("");
      setShowUrlInput(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    setDraggedJobId(jobId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, newStatus: JobStatus) => {
    e.preventDefault();
    if (!draggedJobId) return;

    const updatedJobs = jobs.map((job) =>
      job.id === draggedJobId ? { ...job, status: newStatus } : job
    );

    onJobsChange?.(updatedJobs);
    setDraggedJobId(null);
  };

  const handleMoveJob = (jobId: string, newStatus: JobStatus) => {
    const updatedJobs = jobs.map((job) =>
      job.id === jobId ? { ...job, status: newStatus } : job
    );
    onJobsChange?.(updatedJobs);
  };

  const handleWipLimitChange = (
    status: JobStatus,
    limit: number | undefined
  ) => {
    setWipLimits((prev) => ({
      ...prev,
      [status]: limit,
    }));
  };

  const hasActiveFilters =
    filters.roleFamily.length > 0 ||
    filters.workMode.length > 0 ||
    filters.fitScore.length > 0 ||
    filters.company.length > 0 ||
    filters.tags.length > 0 ||
    filters.status.length > 0;

  const isEmpty = jobs.length === 0;

  return (
    <div className="bg-card rounded-2xl p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-serif font-semibold text-foreground">
          Jobs Created
        </h2>
        <Button
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="gap-2 rounded-full"
        >
          <Plus className="w-4 h-4" />
          Create Job
        </Button>
      </div>

      {/* URL Input */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          showUrlInput ? "max-h-20 opacity-100 mb-4" : "max-h-0 opacity-0"
        )}
      >
        <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
          <Link className="w-5 h-5 text-muted-foreground shrink-0" />
          <Input
            type="url"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            placeholder="Paste job posting URL here..."
            className="flex-1 border-none bg-transparent"
            autoFocus
          />
          <Button size="sm" onClick={handleCreateJob}>
            Add
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowUrlInput(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs, companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters Button */}
        <Button
          variant={hasActiveFilters ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setShowFilters(true)}
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 bg-primary-foreground/20 text-xs px-1.5 rounded-full">
              {filters.roleFamily.length +
                filters.workMode.length +
                filters.fitScore.length +
                filters.status.length +
                filters.tags.length +
                (filters.company ? 1 : 0)}
            </span>
          )}
        </Button>

        {/* View Toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant={viewMode === "board" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode("board")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        {/* Hide Empty Columns */}
        <div className="flex items-center gap-2">
          <Switch
            id="hide-empty"
            checked={hideEmptyColumns}
            onCheckedChange={setHideEmptyColumns}
          />
          <Label htmlFor="hide-empty" className="text-xs text-muted-foreground">
            Hide empty
          </Label>
        </div>
      </div>

      {/* Board / List Content */}
      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <LayoutGrid className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              No jobs yet
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first job card to start tracking your applications.
            </p>
            <Button onClick={() => setShowUrlInput(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Job
            </Button>
          </div>
        </div>
      ) : viewMode === "board" ? (
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="flex gap-4 pb-4 min-h-[500px]">
            {PIPELINE_STAGES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                jobs={jobsByStatus[status]}
                wipLimit={wipLimits[status]}
                onWipLimitChange={handleWipLimitChange}
                onMoveJob={handleMoveJob}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                isHidden={hideEmptyColumns && jobsByStatus[status].length === 0}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* List View - Simple table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_150px_120px_120px] gap-4 px-4 py-3 bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground font-medium">
              <div>Job Title</div>
              <div>Company</div>
              <div>Status</div>
              <div>Fit</div>
            </div>
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="grid grid-cols-[1fr_150px_120px_120px] gap-4 px-4 py-3 border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <div className="font-medium text-foreground truncate">
                  {job.title}
                </div>
                <div className="text-muted-foreground truncate">{job.company}</div>
                <div>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                    {job.status}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {job.fitScore || "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters Drawer */}
      <KanbanFilters
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        onFiltersChange={setFilters}
        availableTags={availableTags}
      />
    </div>
  );
};

export default KanbanBoard;
