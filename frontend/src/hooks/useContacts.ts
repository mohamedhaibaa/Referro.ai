import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getContacts, discoverContacts } from "@/lib/api/contacts";
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

  const mutation = useMutation({
    mutationFn: () => discoverContacts(jobId),
    onSuccess: async (workflowRunId) => {
      setIsPolling(true);
      // Poll until terminal status
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
