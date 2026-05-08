import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listJobs, listArchivedJobs, getJob, createJob, updateJob, deleteJob, restoreJob } from "@/lib/api/jobs";
import { Job } from "@/types/job";

export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: listJobs,
    refetchInterval: 5000, // poll every 5s so job titles update after parsing completes
  });
}

export function useArchivedJobs(enabled = true) {
  return useQuery({
    queryKey: ["jobs", "archived"],
    queryFn: listArchivedJobs,
    enabled,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ["jobs", id],
    queryFn: () => getJob(id),
    enabled: !!id,
    refetchInterval: 5000,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ url, title, company }: { url: string; title?: string; company?: string }) =>
      createJob(url, title, company),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateJob>[1] }) =>
      updateJob(id, patch),
    onSuccess: (updated: Job) => {
      qc.setQueryData(["jobs", updated.id], updated);
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useRestoreJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreJob(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["jobs"] });
      const prevActive = qc.getQueryData<Job[]>(["jobs"]);
      const prevArchived = qc.getQueryData<Job[]>(["jobs", "archived"]);
      if (prevArchived) {
        const restored = prevArchived.find((j) => j.id === id);
        qc.setQueryData<Job[]>(["jobs", "archived"], prevArchived.filter((j) => j.id !== id));
        if (restored && prevActive) {
          qc.setQueryData<Job[]>(["jobs"], [restored, ...prevActive]);
        }
      }
      return { prevActive, prevArchived };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prevActive) qc.setQueryData(["jobs"], ctx.prevActive);
      if (ctx?.prevArchived) qc.setQueryData(["jobs", "archived"], ctx.prevArchived);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

import { getMilestones, updateMilestones, Milestones } from "@/lib/api/jobs";

export function useJobMilestones(jobId: string | undefined) {
  return useQuery({
    queryKey: ["milestones", jobId],
    queryFn: () => getMilestones(jobId!),
    enabled: !!jobId,
  });
}

export function useUpdateMilestones(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Milestones>) => updateMilestones(jobId, patch),
    onSuccess: (updated) => {
      qc.setQueryData(["milestones", jobId], updated);
    },
  });
}
