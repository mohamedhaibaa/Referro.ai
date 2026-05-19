// REF-33b: types for the resume / profile surface.
//
// Wire format note (Q3 locked):
// - Inbound responses use camelCase, transformed in the client functions
//   (getProfile / uploadResume) from REF-33a's snake_case Pydantic
//   output. Matches the repo-wide outbound camelCase convention per
//   CLAUDE.md §5.
// - PATCH body stays snake_case to match REF-33a's ProfilePatch
//   Pydantic model + the repo's inbound convention.

export interface ProfileResponse {
  userId: string;
  resumeFilename: string | null;
  resumeUploadedAt: string | null;        // ISO timestamp or null
  skills: string[];
  experienceYears: number | null;
  experienceSummary: string;
  education: string;
  jobTitlesHistory: string[];
  targetRoles: string[];
  targetCompanies: string[];
  userEditedFields: string[];             // names of fields manually overridden
  isThin: boolean;                        // true when nothing populated
}

export interface UploadResumeResponse {
  profile: ProfileResponse;
  overwroteUserEdits: string[];           // fields whose manual edits were preserved
  parseFailed: boolean;                   // true when AI returned all-empty
}

// PATCH body — snake_case keys match REF-33a's ProfilePatch model.
// All fields optional; only the ones present in the body are touched
// (REF-33a tracks them in user_edited_fields).
export interface ProfilePatch {
  skills?: string[];
  experience_years?: number | null;
  experience_summary?: string;
  education?: string;
  job_titles_history?: string[];
  target_roles?: string[];
  target_companies?: string[];
}
