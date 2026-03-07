import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listJobs, getJob, createJob, updateJob, deleteJob } from "@/lib/api/jobs";
import { Job } from "@/types/job";

export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: listJobs,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ["jobs", id],
    queryFn: () => getJob(id),
    enabled: !!id,
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
