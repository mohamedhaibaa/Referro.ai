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
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      return 2000;
    },
  });
}
