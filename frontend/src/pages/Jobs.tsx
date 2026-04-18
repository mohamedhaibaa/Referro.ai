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
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { PathForwardIllustration, EmptyBoxIllustration } from "@/components/ui/EmptyIllustrations";
import { useNavigate } from "react-router-dom";
import { useJobs, useArchivedJobs, useDeleteJob, useRestoreJob } from "@/hooks/useJobs";
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sortParam = searchParams.get("sort") as SortKey | null;
  const sort: SortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : "recent";

  const [tab, setTab] = useState<"active" | "archived">("active");
  const [query, setQuery] = useState("");

  const activeQuery = useJobs();
  const archivedQuery = useArchivedJobs(tab === "archived");
  const activeJobs = activeQuery.data ?? [];
  const archivedJobs = archivedQuery.data ?? [];
  const activeLoading = activeQuery.isLoading;
  const archivedLoading = archivedQuery.isLoading;
  const deleteJob = useDeleteJob();
  const restoreJob = useRestoreJob();

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
        toast.error("Couldn't archive the job right now.");
      },
    });
  };

  const handleRestore = (job: Job) => {
    restoreJob.mutate(job.id, {
      onSuccess: () => {
        toast("Restored", {
          description: `${job.company || "Job"} moved back to Active.`,
          action: {
            label: "Undo",
            onClick: () => deleteJob.mutate(job.id),
          },
        });
      },
      onError: () => {
        toast.error("Couldn't restore the job right now.");
      },
    });
  };

  const rawJobs = tab === "archived" ? archivedJobs : activeJobs;
  const isLoading = tab === "archived" ? archivedLoading : activeLoading;
  const activeQuery_ = tab === "archived" ? archivedQuery : activeQuery;
  const isError = activeQuery_.isError;
  const visible = useMemo(() => sortJobs(filterJobs(rawJobs, query), sort), [rawJobs, query, sort]);

  const isEmpty = !isLoading && !isError && visible.length === 0;

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

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            headline="Couldn't load your jobs"
            body="Check your connection and try again."
            onRetry={() => activeQuery_.refetch()}
          />
        ) : isEmpty && !query ? (
          tab === "archived" ? (
            <EmptyState
              illustration={<EmptyBoxIllustration />}
              headline="Nothing archived yet"
              body="Archived jobs will appear here. Your active search is where the action is."
            />
          ) : (
            <EmptyState
              illustration={<PathForwardIllustration />}
              headline="Let's find your first job 🚀"
              body="Paste a LinkedIn job URL on the Home page and we'll handle the rest."
              cta={{ label: "Go to Home →", onClick: () => navigate("/") }}
            />
          )
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground">No jobs match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visible.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                archived={tab === "archived"}
                onArchive={tab === "active" ? handleArchive : undefined}
                onRestore={tab === "archived" ? handleRestore : undefined}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Jobs;
