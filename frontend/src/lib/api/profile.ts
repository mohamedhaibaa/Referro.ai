// REF-33b: API client for /api/v1/profile.
// Backends ProfileResponse is snake_case (REF-33a returns the Pydantic
// model directly without a camelize serializer). The client transforms
// to camelCase locally per Q3 lean — keeps REF-33a backend untouched
// while honoring the repo's outbound camelCase convention.

import { api } from "./client";
import type { ProfileResponse, UploadResumeResponse, ProfilePatch } from "@/types/profile";

// Snake-cased backend response shapes (internal — never exported).
interface BackendProfile {
  user_id: string;
  resume_filename: string | null;
  resume_uploaded_at: string | null;
  skills: string[];
  experience_years: number | null;
  experience_summary: string;
  education: string;
  job_titles_history: string[];
  target_roles: string[];
  target_companies: string[];
  user_edited_fields: string[];
  is_thin: boolean;
}

interface ProfileEnvelope {
  data: BackendProfile;
  meta: Record<string, unknown>;
  error: string | null;
}

interface UploadEnvelope {
  data: BackendProfile;
  meta: { overwrote_user_edits: string[]; parse_failed: boolean };
  error: string | null;
}

function toProfile(b: BackendProfile): ProfileResponse {
  return {
    userId: b.user_id,
    resumeFilename: b.resume_filename,
    resumeUploadedAt: b.resume_uploaded_at,
    skills: b.skills ?? [],
    experienceYears: b.experience_years,
    experienceSummary: b.experience_summary ?? "",
    education: b.education ?? "",
    jobTitlesHistory: b.job_titles_history ?? [],
    targetRoles: b.target_roles ?? [],
    targetCompanies: b.target_companies ?? [],
    userEditedFields: b.user_edited_fields ?? [],
    isThin: b.is_thin,
  };
}

export async function getProfile(): Promise<ProfileResponse> {
  const res = await api.get<ProfileEnvelope>("/profile");
  return toProfile(res.data);
}

export async function uploadResume(file: File): Promise<UploadResumeResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.upload<UploadEnvelope>("/profile/resume", form);
  return {
    profile: toProfile(res.data),
    overwroteUserEdits: res.meta.overwrote_user_edits ?? [],
    parseFailed: res.meta.parse_failed ?? false,
  };
}

export async function patchProfile(patch: ProfilePatch): Promise<ProfileResponse> {
  // PATCH body intentionally snake_case — matches REF-33a's inbound Pydantic
  // ProfilePatch model + the repo's inbound convention (CLAUDE.md §5).
  const res = await api.patch<ProfileEnvelope>("/profile", patch);
  return toProfile(res.data);
}

export async function deleteResume(): Promise<void> {
  await api.delete<void>("/profile/resume");
}
