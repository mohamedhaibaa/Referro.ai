import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JobCard from "@/components/jobs/JobCard";
import { useJobs, useArchivedJobs, useDeleteJob } from "@/hooks/useJobs";
import { Job } from "@/types/job";
import { stageSortIndex } from "@/lib/jobStagePill";

type SortKey = "recent" | "company" | "stage";
const SORT_KEYS: SortKey[] = ["recent", "company", "stage"];

function sortJobs(jobs: Job[], sort: SortKey): Job[] {
  const list = [...jobs];
  if (sort === "company") {
    list.sort((a, b) => (a.company || "").localeCompare(b.company || ""));
  } else if (sort === "stage") {
    list.sort((a, b) => stageSortIndex(a.status) - stageSortIndex(b.status));
  }
  // "recent" = backend already returns created_at desc
  return list;
}

function filterJobs(jobs: Job[], query: string): Job[] {
  const q = query.trim().toLowerCase();
  if (!q) return jobs;
  return jobs.filter(
    (j) =>
      j.title.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q)
  );
}

const Jobs = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sortParam = searchParams.get("sort") as SortKey | null;
  const sort: SortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : "recent";

  const [tab, setTab] = useState<"active" | "archived">("active");
  const [query, setQuery] = useState("");

  const { data: activeJobs = [], isLoading: activeLoading } = useJobs();
  const { data: archivedJobs = [], isLoading: archivedLoading } = useArchivedJobs(tab === "archived");
  const deleteJob = useDeleteJob();

  const setSort = (next: SortKey) => {
    const sp = new URLSearchParams(searchParams);
    if (next === "recent") sp.delete("sort");
    else sp.set("sort", next);
    setSearchParams(sp, { replace: true });
  };

  const handleArchive = (job: Job) => {
    deleteJob.mutate(job.id, {
      onSuccess: () => {
        toast("Archived", {
          description: `${job.company || "Job"} moved to Archived.`,
        });
      },
      onError: () => {
        toast.error("Could not archive job");
      },
    });
  };

  const rawJobs = tab === "archived" ? archivedJobs : activeJobs;
  const isLoading = tab === "archived" ? archivedLoading : activeLoading;
  const visible = useMemo(() => sortJobs(filterJobs(rawJobs, query), sort), [rawJobs, query, sort]);

  const isEmpty = !isLoading && visible.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <main className="ml-20 p-8">
        <Header />

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-serif font-bold text-foreground">Jobs</h2>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archived")} className="mb-6">
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs or companies..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most recent</SelectItem>
              <SelectItem value="company">Company A → Z</SelectItem>
              <SelectItem value="stage">Stage</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {tab === "archived" && (
          <p className="mb-4 text-xs text-muted-foreground">
            Restore is coming soon — archived jobs are read-only for now.
          </p>
        )}

        {isLoading ? (
          <div className="text-muted-foreground text-sm py-8">Loading jobs...</div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground mb-2">
              {tab === "archived" ? "No archived jobs." : "No jobs yet."}
            </p>
            {tab === "active" && !query && (
              <a href="/" className="text-sm text-primary hover:underline">
                Paste a job URL on Home to start your first Referro →
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visible.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                archived={tab === "archived"}
                onArchive={tab === "active" ? handleArchive : undefined}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Jobs;
