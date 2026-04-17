import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listContactOutreach,
  createOutreach,
  updateOutreach,
  deleteOutreach,
} from "@/lib/api/outreach";
import { OutreachType } from "@/types/job";

export function useContactOutreach(jobId: string, contactId: string, enabled = true) {
  return useQuery({
    queryKey: ["outreach", jobId, contactId],
    queryFn: () => listContactOutreach(jobId, contactId),
    enabled: enabled && !!jobId && !!contactId,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, jobId: string, contactId: string) {
  qc.invalidateQueries({ queryKey: ["outreach", jobId, contactId] });
  qc.invalidateQueries({ queryKey: ["contacts", jobId] });
}

export function useCreateOutreach(jobId: string, contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, message, isAiGenerated }: { type: OutreachType; message: string; isAiGenerated?: boolean }) =>
      createOutreach(jobId, contactId, type, message, isAiGenerated ?? false),
    onSuccess: () => invalidate(qc, jobId, contactId),
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Could not create draft";
      toast.error(msg);
    },
  });
}

export function useUpdateOutreach(jobId: string, contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ outreachId, patch }: {
      outreachId: string;
      patch: { message?: string; sent_at?: string | null };
    }) => updateOutreach(jobId, outreachId, patch),
    onSuccess: () => invalidate(qc, jobId, contactId),
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Could not update message";
      toast.error(msg);
    },
  });
}

export function useDeleteOutreach(jobId: string, contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (outreachId: string) => deleteOutreach(jobId, outreachId),
    onSuccess: () => invalidate(qc, jobId, contactId),
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Could not delete message";
      toast.error(msg);
    },
  });
}
