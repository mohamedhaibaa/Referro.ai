import { api } from "./client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthPayload {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

interface AuthResponse {
  data: AuthPayload;
  error: string | null;
}

export async function register(email: string, password: string, name: string): Promise<AuthPayload> {
  const res = await api.post<AuthResponse>("/auth/register", { email, password, name });
  localStorage.setItem("access_token", res.data.access_token);
  localStorage.setItem("user", JSON.stringify(res.data.user));
  return res.data;
}

export async function login(email: string, password: string): Promise<AuthPayload> {
  const res = await api.post<AuthResponse>("/auth/login", { email, password });
  localStorage.setItem("access_token", res.data.access_token);
  localStorage.setItem("user", JSON.stringify(res.data.user));
  return res.data;
}

export function logout(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem("access_token");
}
