"use client";

import { useState, useTransition } from "react";
import { runScrapeNow } from "@/app/jobs/actions";

export function RunScrapeButton() {
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);

  function handleClick() {
    setSummary(null);
    startTransition(async () => {
      const results = await runScrapeNow();
      const found = results.reduce((sum, r) => sum + r.count, 0);
      const failed = results.filter((r) => r.error).length;
      setSummary(`${found} avisos${failed ? `, ${failed} fuente(s) fallaron` : ""}`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="font-mono text-[11px] uppercase tracking-widest border border-accent text-accent rounded px-2.5 py-1.5 hover:bg-accent hover:text-accent-ink transition disabled:opacity-50"
      >
        {isPending ? "Buscando..." : "Buscar ahora"}
      </button>
      {summary && <span className="text-xs text-text-muted">{summary}</span>}
    </div>
  );
}
