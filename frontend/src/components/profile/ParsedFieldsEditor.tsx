// REF-33b: per-field structured editor for parsed resume data (DQ-D).
//
// Includes an inline <TagInput> component (Q5 — no chip-input
// component existed in components/ui; built inline since this file is
// the only caller, used 4× for skills / titles / target_roles /
// target_companies).
//
// Shows an "edited" badge next to fields the user has manually
// overridden (drawn from profile.userEditedFields). Saves only the
// dirty fields, so manual edits land in REF-33a's
// user_edited_fields list and are preserved across re-upload (DQ-K).

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProfilePatch, ProfileResponse } from "@/types/profile";

interface Props {
  profile: ProfileResponse;
  onSave: (patch: ProfilePatch) => Promise<unknown>;
  saveLabel?: string;
  isSaving?: boolean;
}

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  id?: string;
}

const TagInput = ({ value, onChange, placeholder, id }: TagInputProps) => {
  const [draft, setDraft] = useState("");

  const addTag = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-destructive"
              aria-label={`Remove ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="button" variant="secondary" onClick={addTag} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
};

const EditedBadge = ({ shown }: { shown: boolean }) => {
  if (!shown) return null;
  return (
    <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary">
      edited
    </span>
  );
};

const ParsedFieldsEditor = ({ profile, onSave, saveLabel = "Save changes", isSaving = false }: Props) => {
  // Shadow state — initialize from profile and reset whenever profile prop
  // identity changes (i.e. after a successful save → React Query refetch).
  const [skills, setSkills] = useState<string[]>(profile.skills);
  const [experienceYears, setExperienceYears] = useState<string>(
    profile.experienceYears !== null && profile.experienceYears !== undefined
      ? String(profile.experienceYears)
      : ""
  );
  const [experienceSummary, setExperienceSummary] = useState<string>(profile.experienceSummary);
  const [education, setEducation] = useState<string>(profile.education);
  const [jobTitlesHistory, setJobTitlesHistory] = useState<string[]>(profile.jobTitlesHistory);
  const [targetRoles, setTargetRoles] = useState<string[]>(profile.targetRoles);
  const [targetCompanies, setTargetCompanies] = useState<string[]>(profile.targetCompanies);

  useEffect(() => {
    setSkills(profile.skills);
    setExperienceYears(
      profile.experienceYears !== null && profile.experienceYears !== undefined
        ? String(profile.experienceYears)
        : ""
    );
    setExperienceSummary(profile.experienceSummary);
    setEducation(profile.education);
    setJobTitlesHistory(profile.jobTitlesHistory);
    setTargetRoles(profile.targetRoles);
    setTargetCompanies(profile.targetCompanies);
  }, [profile]);

  // Build the dirty patch — only include fields that differ from the
  // current profile. Stays minimal so user_edited_fields tracks exactly
  // what the user touched.
  const patch = useMemo<ProfilePatch>(() => {
    const out: ProfilePatch = {};
    if (JSON.stringify(skills) !== JSON.stringify(profile.skills)) out.skills = skills;
    const expNum = experienceYears.trim() === "" ? null : Number(experienceYears);
    if (expNum !== profile.experienceYears && !(Number.isNaN(expNum) && profile.experienceYears === null)) {
      out.experience_years = expNum;
    }
    if (experienceSummary !== profile.experienceSummary) out.experience_summary = experienceSummary;
    if (education !== profile.education) out.education = education;
    if (JSON.stringify(jobTitlesHistory) !== JSON.stringify(profile.jobTitlesHistory)) {
      out.job_titles_history = jobTitlesHistory;
    }
    if (JSON.stringify(targetRoles) !== JSON.stringify(profile.targetRoles)) {
      out.target_roles = targetRoles;
    }
    if (JSON.stringify(targetCompanies) !== JSON.stringify(profile.targetCompanies)) {
      out.target_companies = targetCompanies;
    }
    return out;
  }, [
    skills, experienceYears, experienceSummary, education,
    jobTitlesHistory, targetRoles, targetCompanies, profile,
  ]);

  const isDirty = Object.keys(patch).length > 0;
  const edited = new Set(profile.userEditedFields);

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    await onSave(patch);
  };

  const summaryLen = experienceSummary.length;
  const educationLen = education.length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="skills">
          Skills
          <EditedBadge shown={edited.has("skills")} />
        </Label>
        <TagInput
          id="skills"
          value={skills}
          onChange={setSkills}
          placeholder="Add a skill and press Enter"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="experience-years">
          Years of professional experience
          <EditedBadge shown={edited.has("experience_years")} />
        </Label>
        <Input
          id="experience-years"
          type="number"
          min={0}
          max={60}
          value={experienceYears}
          onChange={(e) => setExperienceYears(e.target.value)}
          placeholder="e.g. 6"
          className="max-w-[140px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="experience-summary">
          Experience summary
          <EditedBadge shown={edited.has("experience_summary")} />
        </Label>
        <Textarea
          id="experience-summary"
          value={experienceSummary}
          onChange={(e) => setExperienceSummary(e.target.value.slice(0, 500))}
          rows={4}
          placeholder="2-3 sentence neutral summary of your background"
        />
        <p className="text-xs text-muted-foreground text-right">{summaryLen}/500</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="education">
          Education
          <EditedBadge shown={edited.has("education")} />
        </Label>
        <Textarea
          id="education"
          value={education}
          onChange={(e) => setEducation(e.target.value.slice(0, 300))}
          rows={2}
          placeholder="e.g. MS Computer Science, NYU (2022)"
        />
        <p className="text-xs text-muted-foreground text-right">{educationLen}/300</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="job-titles">
          Past job titles
          <EditedBadge shown={edited.has("job_titles_history")} />
        </Label>
        <TagInput
          id="job-titles"
          value={jobTitlesHistory}
          onChange={setJobTitlesHistory}
          placeholder="e.g. Senior Software Engineer, Stripe"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="target-roles">
          Roles you're targeting
          <EditedBadge shown={edited.has("target_roles")} />
        </Label>
        <TagInput
          id="target-roles"
          value={targetRoles}
          onChange={setTargetRoles}
          placeholder="e.g. Senior Backend Engineer"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="target-companies">
          Companies you're targeting
          <EditedBadge shown={edited.has("target_companies")} />
        </Label>
        <TagInput
          id="target-companies"
          value={targetCompanies}
          onChange={setTargetCompanies}
          placeholder="e.g. Stripe, Anthropic"
        />
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={!isDirty || isSaving}>
          {isSaving ? "Saving…" : saveLabel}
        </Button>
      </div>
    </div>
  );
};

export default ParsedFieldsEditor;
