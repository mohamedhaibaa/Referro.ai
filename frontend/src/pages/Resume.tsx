// REF-33b: /resume page.
//
// Scope correction (workflow): replaces what the original plan called
// Settings.tsx. The Sidebar already wires /resume (line 14); this is
// the page that route now resolves to. /settings stays unowned until
// a future ticket adds non-resume settings.
//
// Bug A fix (build-review iteration): pre-fix this page gated rendering
// solely on useProfile().isThin. After a parseFailed=true upload, all
// fields including raw_resume_text are empty → backend computes
// is_thin=true → page rendered the upload card AGAIN, even though the
// toast said "fill them in below". Users were stuck.
//
// Mirror OnboardingResume.tsx's pattern: hold the just-completed upload
// in local state (uploadResult). When set, render the editor seeded
// from uploadResult.profile regardless of isThin. After a successful
// save, clear uploadResult so the next render uses the refetched
// profile from useProfile(). After delete, clear uploadResult so the
// upload card returns.

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ResumeUploadCard from "@/components/profile/ResumeUploadCard";
import ParsedFieldsEditor from "@/components/profile/ParsedFieldsEditor";
import {
  useDeleteResume,
  usePatchProfile,
  useProfile,
  useUploadResume,
} from "@/hooks/useProfile";
import type { ProfilePatch, ProfileResponse, UploadResumeResponse } from "@/types/profile";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return iso;
  }
}

const Resume = () => {
  const { profile, isLoading, isThin } = useProfile();
  const patch = usePatchProfile();
  const upload = useUploadResume();
  const del = useDeleteResume();
  const replaceInputRef = useRef<HTMLInputElement>(null);
  // Bug A fix: local state for the just-completed upload. When non-null,
  // we render the editor against this profile regardless of isThin —
  // covers the parseFailed=true case where the server's profile is
  // legitimately all-empty.
  const [uploadResult, setUploadResult] = useState<UploadResumeResponse | null>(null);

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="ml-20 min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  // Single source of truth for which profile the editor shows.
  // - Just-uploaded path (uploadResult set): use the upload response's
  //   profile. Crucial for parseFailed=true: even though the server
  //   returns is_thin=true, we want the editor with empty fields so
  //   the user can fill in manually.
  // - Steady-state path (no uploadResult): use the refetched profile.
  const editorProfile: ProfileResponse = uploadResult?.profile ?? profile;
  const showEditor = uploadResult !== null || !isThin;

  const handleUploadComplete = (result: UploadResumeResponse) => {
    if (result.parseFailed) {
      toast.message(
        "Resume saved, but we couldn't extract the fields — please fill them in below.",
      );
    } else if (result.overwroteUserEdits.length > 0) {
      toast.success(
        `Resume replaced. Your manual edits to ${result.overwroteUserEdits.join(", ")} were preserved.`,
      );
    } else {
      toast.success("Resume uploaded");
    }
    setUploadResult(result);
  };

  const handleReplaceClick = () => replaceInputRef.current?.click();

  const handleReplaceFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    upload.mutate(file, {
      onSuccess: handleUploadComplete,
      onError: (err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Couldn't replace resume.");
      },
    });
    // Reset the input so picking the same filename again still fires onChange.
    if (replaceInputRef.current) replaceInputRef.current.value = "";
  };

  const handleSavePatch = async (p: ProfilePatch) => {
    await patch.mutateAsync(p, {
      onSuccess: () => {
        toast.success("Changes saved");
        // Bug A fix: drop the upload-result snapshot so subsequent renders
        // use the refetched profile (which now includes the user's edits +
        // the user_edited_fields tracking).
        setUploadResult(null);
      },
      onError: (e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Couldn't save changes"),
    });
  };

  const handleConfirmDelete = () => {
    del.mutate(undefined, {
      onSuccess: () => {
        toast.success("Resume data deleted");
        // Bug A fix: clear the snapshot so isThin (now true from refetch)
        // takes over and the upload card returns.
        setUploadResult(null);
      },
      onError: (e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Couldn't delete"),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-20 min-h-screen p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <header>
            <h1 className="text-3xl font-serif font-bold text-foreground">Resume</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your background powers every AI draft Referro writes for you.
            </p>
          </header>

          <section className="bg-card border border-border rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-foreground">
              Resume &amp; Background
            </h2>

            {!showEditor ? (
              <ResumeUploadCard
                showSkipButton={false}
                onUploadComplete={handleUploadComplete}
              />
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="text-sm">
                    <p className="font-medium text-foreground">
                      {editorProfile.resumeFilename || "(no filename)"}
                    </p>
                    <p className="text-muted-foreground">
                      Uploaded {formatDate(editorProfile.resumeUploadedAt)}
                    </p>
                    {uploadResult?.parseFailed && (
                      <p className="text-amber-700 mt-2">
                        We saved the file but couldn't extract the fields.
                        Please fill them in below and save.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleReplaceClick}
                      disabled={upload.isPending}
                    >
                      {upload.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Replace resume"
                      )}
                    </Button>
                    <input
                      ref={replaceInputRef}
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={(e) => handleReplaceFiles(e.target.files)}
                    />
                  </div>
                </div>

                <ParsedFieldsEditor
                  profile={editorProfile}
                  isSaving={patch.isPending}
                  onSave={handleSavePatch}
                />

                <div className="border-t border-border pt-4 flex justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        Delete my resume data
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete your resume data?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently removes your uploaded resume and all
                          parsed fields. AI drafts will fall back to generic
                          context until you upload again. This action cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleConfirmDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default Resume;
