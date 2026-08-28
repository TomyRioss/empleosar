"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { setJobStatus } from "@/app/jobs/actions";
import { JobStatusValue } from "@prisma/client";
import { TT_STATUS_APPLIED } from "@/lib/extensionBridge";
import { FaRegBookmark, FaBookmark, FaRegCircleCheck, FaCircleCheck, FaRegCircleXmark, FaCircleXmark } from "react-icons/fa6";
import type { IconType } from "react-icons";

const GUEST_STORAGE_KEY = "guestJobStatus";

function subscribeToGuestStatus(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readGuestStatus(jobId: string): JobStatusValue | null {
  try {
    const map = JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY) ?? "{}");
    return map[jobId] ?? null;
  } catch {
    return null;
  }
}

function writeGuestStatus(jobId: string, status: JobStatusValue) {
  const map = JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY) ?? "{}");
  map[jobId] = status;
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(map));
}

const LABELS: Record<JobStatusValue, string> = {
  SAVED: "Guardar",
  APPLIED: "Aplicado",
  DISCARDED: "Descartar",
};

const ICON: Record<JobStatusValue, { off: IconType; on: IconType }> = {
  SAVED: { off: FaRegBookmark, on: FaBookmark },
  APPLIED: { off: FaRegCircleCheck, on: FaCircleCheck },
  DISCARDED: { off: FaRegCircleXmark, on: FaCircleXmark },
};

// Pastel by default (color/10 fill), deeper tint when active — never plain text/border.
const IDLE_CLASS: Record<JobStatusValue, string> = {
  SAVED: "bg-status-saved/10 border-status-saved/25 text-status-saved hover:bg-status-saved/20",
  APPLIED: "bg-status-applied/10 border-status-applied/25 text-status-applied hover:bg-status-applied/20",
  DISCARDED: "bg-status-discarded/10 border-status-discarded/25 text-status-discarded hover:bg-status-discarded/20",
};

const ACTIVE_CLASS: Record<JobStatusValue, string> = {
  SAVED: "bg-status-saved/25 border-status-saved text-status-saved",
  APPLIED: "bg-status-applied/25 border-status-applied text-status-applied",
  DISCARDED: "bg-status-discarded/25 border-status-discarded text-status-discarded",
};

export function StatusButtons({
  jobId,
  isLoggedIn,
  initialStatus,
}: {
  jobId: string;
  isLoggedIn: boolean;
  initialStatus: JobStatusValue | null;
}) {
  // Guest status lives in localStorage; useSyncExternalStore reads it safely
  // across server (null snapshot) and client without a render-then-effect flash.
  const guestStatus = useSyncExternalStore(
    subscribeToGuestStatus,
    () => readGuestStatus(jobId),
    () => null,
  );

  const [override, setOverride] = useState<JobStatusValue | null>(null);
  const status = override ?? (isLoggedIn ? initialStatus : guestStatus);

  function handleClick(next: JobStatusValue) {
    setOverride(next);
    if (isLoggedIn) {
      setJobStatus(jobId, next);
    } else {
      writeGuestStatus(jobId, next);
    }
  }

  // La extensión confirma el envío de la postulación desde el portal.
  useEffect(() => {
    function onAutoApplied(event: Event) {
      const detail = (event as CustomEvent<{ jobId?: string }>).detail;
      if (!detail || detail.jobId !== jobId) return;
      handleClick("APPLIED");
    }
    window.addEventListener(TT_STATUS_APPLIED, onAutoApplied);
    return () => window.removeEventListener(TT_STATUS_APPLIED, onAutoApplied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, isLoggedIn]);

  return (
    <div className="flex gap-2 mt-3">
      {(Object.keys(LABELS) as JobStatusValue[]).map((s) => {
        const active = status === s;
        const Icon = active ? ICON[s].on : ICON[s].off;
        return (
          <button
            key={s}
            type="button"
            onClick={() => handleClick(s)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-full px-2.5 py-1 transition ${
              active ? ACTIVE_CLASS[s] : IDLE_CLASS[s]
            }`}
          >
            <Icon className="shrink-0" size={12} />
            {LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}
