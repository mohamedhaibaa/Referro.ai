import { api } from "./client";
import { UserCredits } from "@/types/job";

interface CreditsResponse {
  data: UserCredits;
  meta: Record<string, unknown>;
  error: string | null;
}

export async function getMyCredits(): Promise<UserCredits> {
  const res = await api.get<CreditsResponse>("/credits/me");
  return res.data;
}
