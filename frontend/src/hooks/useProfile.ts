// REF-33b: React Query hooks for the profile/resume surface.
// Cache key ["profile"] per CLAUDE.md §5 conventions. Every mutation
// invalidates that key so the next consumer reads fresh data.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteResume, getProfile, patchProfile, uploadResume } from "@/lib/api/profile";
import type { ProfilePatch } from "@/types/profile";

export function useProfile() {
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    // Stale time short — the resume page mutations invalidate explicitly
    // so this only matters for cross-tab consistency.
    staleTime: 30_000,
  });

  return {
    profile: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    // Default to thin until we know otherwise. Banner renders only when
    // the query has resolved AND isThin is true (see ResumeNudgeBanner).
    isThin: query.data?.isThin ?? true,
    refetch: query.refetch,
  };
}

export function useUploadResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadResume(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function usePatchProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => patchProfile(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useDeleteResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteResume(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
