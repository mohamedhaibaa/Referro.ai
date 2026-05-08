import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkflowRun } from "@/hooks/useWorkflowRun";

const STORAGE_KEY = "referroing:active";
const STORAGE_VERSION = 2;
const STALL_THRESHOLD_MS = 10 * 60 * 1000;

export type ReferroingUiMode = "blurred" | "pill" | "hidden";
export type ReferroingStatus = "running" | "completed" | "failed" | "stalled";
export type ReferroingPhase = "parsing" | "discovery";

export interface ActiveReferro {
  jobId: string;
  parsingWorkflowRunId: string;
  discoveryWorkflowRunId: string | null;
  currentRunId: string;
  phase: ReferroingPhase;
  jobTitle?: string;
  companyName?: string;
  startedAt: number;
}

interface StartReferroInput {
  jobId: string;
  workflowRunId: string;
  jobTitle?: string;
  companyName?: string;
}

interface StoredShape {
  version: number;
  active: ActiveReferro;
  uiMode: ReferroingUiMode;
}

interface ReferroingContextValue {
  activeReferro: ActiveReferro | null;
  uiMode: ReferroingUiMode;
  status: ReferroingStatus;
  phase: ReferroingPhase;
  errorMessage: string | null;
  isActive: boolean;
  startReferro: (r: StartReferroInput) => void;
  dismissBlur: () => void;
  openBlur: () => void;
  clearReferro: () => void;
  openActiveRoom: () => void;
}

const ReferroingContext = createContext<ReferroingContextValue | null>(null);

function loadFromStorage(): { active: ActiveReferro | null; uiMode: ReferroingUiMode } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { active: null, uiMode: "hidden" };
    const parsed = JSON.parse(raw) as Partial<StoredShape>;
    if (parsed.version !== STORAGE_VERSION || !parsed.active) {
      localStorage.removeItem(STORAGE_KEY);
      return { active: null, uiMode: "hidden" };
    }
    const a = parsed.active;
    if (!a.jobId || !a.parsingWorkflowRunId || !a.currentRunId) {
      localStorage.removeItem(STORAGE_KEY);
      return { active: null, uiMode: "hidden" };
    }
    const uiMode: ReferroingUiMode = parsed.uiMode === "blurred" ? "pill" : (parsed.uiMode ?? "pill");
    return { active: a, uiMode };
  } catch {
    return { active: null, uiMode: "hidden" };
  }
}

function persistToStorage(active: ActiveReferro | null, uiMode: ReferroingUiMode) {
  if (!active) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const payload: StoredShape = { version: STORAGE_VERSION, active, uiMode };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function ReferroingProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const initial = useMemo(loadFromStorage, []);
  const [activeReferro, setActiveReferro] = useState<ActiveReferro | null>(initial.active);
  const [uiMode, setUiMode] = useState<ReferroingUiMode>(initial.active ? initial.uiMode : "hidden");

  const { data: workflowRun } = useWorkflowRun(activeReferro?.currentRunId ?? null);

  const elapsed = activeReferro ? Date.now() - activeReferro.startedAt : 0;
  const rawStatus = workflowRun?.status;
  const phase = activeReferro?.phase ?? "parsing";

  // Derived top-level status: the pipeline is "completed" only when the
  // discovery phase finishes; a completed parsing run mid-chain is still "running".
  const status: ReferroingStatus = (() => {
    if (!activeReferro) return "running";
    if (rawStatus === "failed") return "failed";
    if (phase === "discovery" && rawStatus === "completed") return "completed";
    if (elapsed > STALL_THRESHOLD_MS) return "stalled";
    return "running";
  })();

  const errorMessage = rawStatus === "failed" ? (workflowRun?.errorMessage ?? "Something went wrong.") : null;

  useEffect(() => {
    persistToStorage(activeReferro, uiMode);
  }, [activeReferro, uiMode]);

  const clearReferro = useCallback(() => {
    setActiveReferro(null);
    setUiMode("hidden");
  }, []);

  const openActiveRoom = useCallback(() => {
    if (!activeReferro) return;
    const jobId = activeReferro.jobId;
    clearReferro();
    navigate(`/jobs/${jobId}/room`);
  }, [activeReferro, clearReferro, navigate]);

  // Phase transitions + terminal navigation.
  useEffect(() => {
    if (!activeReferro) return;

    if (phase === "parsing" && rawStatus === "completed") {
      const chainedId = (workflowRun?.outputData as Record<string, unknown> | null)?.[
        "_chained_discovery_run_id"
      ];
      if (typeof chainedId === "string" && chainedId.length > 0) {
        // Pivot to discovery polling without tearing the overlay down.
        setActiveReferro((prev) =>
          prev
            ? { ...prev, discoveryWorkflowRunId: chainedId, currentRunId: chainedId, phase: "discovery" }
            : prev
        );
        qc.invalidateQueries({ queryKey: ["jobs"] });
        return;
      }
      // Chain publish failed — parsing succeeded but no discovery was queued.
      // Navigate to Room; Room's auto-discovery trigger covers the fallback.
      qc.invalidateQueries({ queryKey: ["jobs"] });
      openActiveRoom();
      return;
    }

    if (phase === "discovery" && rawStatus === "completed") {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["contacts", activeReferro.jobId] });
      if (uiMode === "blurred") {
        openActiveRoom();
      }
      return;
    }

    if (phase === "discovery" && rawStatus === "failed") {
      // Soft-fail into the Room. Room's existing retry UX handles the recovery.
      qc.invalidateQueries({ queryKey: ["jobs"] });
      openActiveRoom();
    }
  }, [phase, rawStatus, activeReferro, uiMode, openActiveRoom, qc, workflowRun?.outputData]);

  const startReferro = useCallback((r: StartReferroInput) => {
    setActiveReferro({
      jobId: r.jobId,
      parsingWorkflowRunId: r.workflowRunId,
      discoveryWorkflowRunId: null,
      currentRunId: r.workflowRunId,
      phase: "parsing",
      jobTitle: r.jobTitle,
      companyName: r.companyName,
      startedAt: Date.now(),
    });
    setUiMode("blurred");
  }, []);

  const dismissBlur = useCallback(() => {
    setUiMode((m) => (m === "blurred" ? "pill" : m));
  }, []);

  const openBlur = useCallback(() => {
    if (activeReferro) setUiMode("blurred");
  }, [activeReferro]);

  const value: ReferroingContextValue = {
    activeReferro,
    uiMode,
    status,
    phase,
    errorMessage,
    isActive: !!activeReferro,
    startReferro,
    dismissBlur,
    openBlur,
    clearReferro,
    openActiveRoom,
  };

  return <ReferroingContext.Provider value={value}>{children}</ReferroingContext.Provider>;
}

export function useReferroing() {
  const ctx = useContext(ReferroingContext);
  if (!ctx) throw new Error("useReferroing must be used inside ReferroingProvider");
  return ctx;
}
