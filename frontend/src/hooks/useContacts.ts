import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getContacts, discoverContacts, revisitContacts } from "@/lib/api/contacts";
import { getWorkflowRun } from "@/lib/api/workflowRuns";
import { useState } from "react";

export function useContacts(jobId: string) {
  return useQuery({
    queryKey: ["contacts", jobId],
    queryFn: () => getContacts(jobId),
    enabled: !!jobId,
  });
}

export function useDiscoverContacts(jobId: string) {
  const qc = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const mutation = useMutation({
    mutationFn: ({ batchNumber, roundNumber }: { batchNumber: number; roundNumber: number }) =>
      discoverContacts(jobId, batchNumber, roundNumber),
    onSuccess: async (result) => {
      setHasMore(result.hasMore);
      if (result.contacts !== undefined) {
        // Sync path: batch 2 or 3 returned directly from DB
        qc.invalidateQueries({ queryKey: ["contacts", jobId] });
      } else if (result.workflowRunId) {
        // Async path: batch 1, worker is running
        setIsPolling(true);
        const poll = async () => {
          const wf = await getWorkflowRun(result.workflowRunId!);
          if (wf.status === "completed" || wf.status === "failed") {
            setIsPolling(false);
            qc.invalidateQueries({ queryKey: ["contacts", jobId] });
            qc.invalidateQueries({ queryKey: ["credits"] });
          } else {
            setTimeout(poll, 2000);
          }
        };
        poll();
      }
    },
  });

  const discoverBatch = (batchNumber: number, roundNumber: number) => {
    mutation.mutate({ batchNumber, roundNumber });
  };

  return { ...mutation, discoverBatch, isPolling, hasMore };
}

export function useRevisitContacts(jobId: string) {
  const qc = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);

  const mutation = useMutation({
    mutationFn: () => revisitContacts(jobId),
    onSuccess: async ({ workflowRunId }) => {
      setIsPolling(true);
      qc.invalidateQueries({ queryKey: ["credits"] });
      const poll = async () => {
        const wf = await getWorkflowRun(workflowRunId);
        if (wf.status === "completed" || wf.status === "failed") {
          setIsPolling(false);
          qc.invalidateQueries({ queryKey: ["contacts", jobId] });
        } else {
          setTimeout(poll, 2000);
        }
      };
      poll();
    },
  });

  return { ...mutation, isPolling };
}
