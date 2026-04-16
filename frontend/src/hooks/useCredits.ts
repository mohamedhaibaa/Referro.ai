import { useQuery } from "@tanstack/react-query";
import { getMyCredits } from "@/lib/api/credits";

export function useCredits() {
  return useQuery({
    queryKey: ["credits"],
    queryFn: getMyCredits,
    staleTime: 30_000,
  });
}
