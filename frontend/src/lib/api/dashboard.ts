import { api } from "./client";

export interface DashboardData {
  totalJobs: number;
  byStatus: Record<string, number>;
  outreachSent: number;
  meetings: number;
  offers: number;
  user: { id: string; email: string; name: string };
}

export async function getDashboard(): Promise<DashboardData> {
  const res = await api.get<{ data: DashboardData; error: string | null }>("/dashboard");
  return res.data;
}
