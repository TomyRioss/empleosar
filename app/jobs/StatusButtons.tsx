"use client";

import { useState, useSyncExternalStore } from "react";
import { setJobStatus } from "@/app/jobs/actions";
import { JobStatusValue } from "@prisma/client";

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

  return (
    <div className="flex gap-2 mt-3">
      {(Object.keys(LABELS) as JobStatusValue[]).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => handleClick(s)}
          className={`text-xs border rounded px-2 py-1 ${status === s ? "bg-black text-white" : ""}`}
        >
          {LABELS[s]}
        </button>
      ))}
    </div>
  );
}
