import { useQuery } from "@tanstack/react-query";
import { getWorkflowRun } from "@/lib/api/workflowRuns";

const TERMINAL_STATUSES = ["completed", "failed"];

/**
 * Polls GET /workflow-runs/{id} every 2 seconds.
 * Stops automatically when status is 'completed' or 'failed'.
 */
export function useWorkflowRun(workflowRunId: string | null) {
  return useQuery({
    queryKey: ["workflow-runs", workflowRunId],
    queryFn: () => getWorkflowRun(workflowRunId!),
    enabled: !!workflowRunId,
    // REF-26: stop polling on persistent error (auth, network, etc.) so a
    // stuck workflow_run + expired token can't loop forever. Cap retries
    // so we don't get a 3-retry storm on each tick.
    retry: 1,
    retryDelay: 1000,
    refetchInterval: (query) => {
      if (query.state.error) return false;
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      return 2000;
    },
  });
}
