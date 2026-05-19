// REF-33b: shared resume upload card. Used by both /onboarding/resume
// and /resume so the upload UI stays consistent.

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadResume } from "@/hooks/useProfile";
import type { UploadResumeResponse } from "@/types/profile";

interface Props {
  onUploadComplete: (result: UploadResumeResponse) => void;
  showSkipButton: boolean;
  onSkip?: () => void;
}

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 5 * 1024 * 1024;

function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
    return "Use a PDF or DOCX file.";
  }
  if (file.size > MAX_BYTES) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`;
  }
  if (file.size === 0) {
    return "File is empty.";
  }
  return null;
}

function statusErrorCopy(err: Error): string {
  const msg = err.message || "";
  if (msg.includes("413") || msg.toLowerCase().includes("too large")) return "File too large (max 5MB).";
  if (msg.includes("415") || msg.toLowerCase().includes("unsupported")) return "Unsupported file type. Use PDF or DOCX.";
  if (msg.includes("500") || msg.toLowerCase().includes("failed to store")) return "Couldn't save your resume. Please try again.";
  return msg || "Upload failed. Please try again.";
}

const ResumeUploadCard = ({ onUploadComplete, showSkipButton, onSkip }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setDragging] = useState(false);
  const upload = useUploadResume();

  const handleFiles = (files: FileList | null) => {
    setError(null);
    if (!files || files.length === 0) return;
    const file = files[0];
    const v = validateFile(file);
    if (v) {
      setError(v);
      return;
    }
    upload.mutate(file, {
      onSuccess: onUploadComplete,
      onError: (err: unknown) => {
        setError(statusErrorCopy(err instanceof Error ? err : new Error(String(err))));
      },
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const isUploading = upload.isPending;

  return (
    <div className="w-full max-w-xl space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border bg-card"
        }`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Parsing your resume…</p>
            <p className="text-xs">This usually takes 5–10 seconds.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <FileUp className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              Drag and drop your resume, or
            </p>
            <Button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
            >
              Choose a file
            </Button>
            <p className="text-xs text-muted-foreground">PDF or DOCX, up to 5MB</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {showSkipButton && !isUploading && (
        <div className="flex justify-center">
          <Button type="button" variant="ghost" onClick={onSkip}>
            Skip for now
          </Button>
        </div>
      )}
    </div>
  );
};

export default ResumeUploadCard;
