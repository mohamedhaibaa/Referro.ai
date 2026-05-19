// REF-33b: post-signup onboarding step.
//
// State machine (component-local):
//   idle      — show ResumeUploadCard with Skip button
//   reviewing — show ParsedFieldsEditor after a successful upload
//               (handles both parseFailed=true and successful parse)
//
// Skip path (DQ-I) → navigate("/") immediately. ResumeNudgeBanner
// on Home picks up from there.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ResumeUploadCard from "@/components/profile/ResumeUploadCard";
import ParsedFieldsEditor from "@/components/profile/ParsedFieldsEditor";
import { usePatchProfile } from "@/hooks/useProfile";
import type { UploadResumeResponse } from "@/types/profile";

const OnboardingResume = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState<UploadResumeResponse | null>(null);
  const patch = usePatchProfile();

  const goHome = () => navigate("/");

  if (!result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-serif font-bold text-foreground">
              Upload your resume
            </h1>
            <p className="text-muted-foreground">
              Referro uses your background to write personalized outreach.
              Drafts get noticeably more contextual once we have your resume.
            </p>
          </div>
          <ResumeUploadCard
            showSkipButton
            onSkip={goHome}
            onUploadComplete={(r) => setResult(r)}
          />
        </div>
      </div>
    );
  }

  // Reviewing — parsed (or parse-failed) result available.
  const isParseFailed = result.parseFailed;
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-serif font-bold text-foreground">
            {isParseFailed ? "Resume saved — please fill in the fields" : "Here's what we pulled"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isParseFailed
              ? "We saved your resume but couldn't extract the fields automatically. Please fill them in below."
              : "Edit anything that's off. These details ground every AI draft we write for you."}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <ParsedFieldsEditor
            profile={result.profile}
            saveLabel="Save & continue"
            isSaving={patch.isPending}
            onSave={async (p) => {
              await patch.mutateAsync(p, {
                onSuccess: () => {
                  toast.success("Saved your edits");
                  goHome();
                },
                onError: (e: unknown) => {
                  toast.error(e instanceof Error ? e.message : "Couldn't save");
                },
              });
            }}
          />
        </div>

        {!isParseFailed && (
          <div className="flex justify-center">
            <Button variant="ghost" onClick={goHome}>
              Looks right, continue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingResume;
