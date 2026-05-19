// REF-33b: dismissible banner shown on Home (Q2 lean) when the user
// has no resume on file. Per DQ-E:
//   - sessionStorage (not localStorage): dismissal persists for the
//     current tab/session only. New tab → banner reappears.
//   - Once a resume is uploaded, isThin becomes false → banner is gone
//     until the user DELETEs.

import { useState } from "react";
import { Link } from "react-router-dom";
import { FileUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";

const DISMISS_KEY = "resume-nudge-dismissed";

const ResumeNudgeBanner = () => {
  const { isThin, isLoading } = useProfile();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "true";
    } catch {
      // Private mode / disabled storage — treat as not dismissed.
      return false;
    }
  });

  if (isLoading || !isThin || dismissed) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // Swallow — banner still hides in component state.
    }
    setDismissed(true);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <FileUp className="w-5 h-5 text-amber-600 shrink-0" />
        <p className="text-sm">
          <strong>Upload your resume</strong> to get noticeably more personalized AI drafts.
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button asChild size="sm" variant="default">
          <Link to="/resume">Upload now</Link>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="h-8 w-8 text-amber-700 hover:bg-amber-100"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ResumeNudgeBanner;
