import { JobSource } from "@prisma/client";
import { runScrapers, type LogEntry } from "@/scraper/runner";

export type SeqLogEntry = LogEntry & { seq: number };
type Listener = (entry: SeqLogEntry) => void;

// In-memory singleton, scoped to the running Next.js dev server process — a
// browser page reload doesn't touch it, so the scrape (and its log history)
// survives a refresh. It does NOT survive a server restart; that's fine for
// a dev-only tool.
let running = false;
let startedAt: number | null = null;
let endedAt: number | null = null;
let abortController: AbortController | null = null;
let logs: SeqLogEntry[] = [];
let seqCounter = 0;
const listeners = new Set<Listener>();

function emit(entry: LogEntry) {
  const withSeq: SeqLogEntry = { ...entry, seq: ++seqCounter };
  logs.push(withSeq);
  for (const listener of listeners) listener(withSeq);
}

export function getSnapshot() {
  return { running, startedAt, endedAt, logs };
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startScrapeJob(): boolean {
  if (running) return false;

  running = true;
  startedAt = Date.now();
  endedAt = null;
  logs = [];
  seqCounter = 0;
  abortController = new AbortController();
  const signal = abortController.signal;

  emit({ type: "start", message: "Initializing scrapers..." });

  (async () => {
    try {
      const { scrapeReddit } = await import("@/scraper/sources/reddit");
      const { scrapeComputrabajo } = await import("@/scraper/sources/computrabajo");
      const { scrapeZonajobs } = await import("@/scraper/sources/zonajobs");

      await runScrapers(
        {
          [JobSource.REDDIT]: scrapeReddit,
          [JobSource.COMPUTRABAJO]: scrapeComputrabajo,
          [JobSource.ZONAJOBS]: scrapeZonajobs,
        },
        emit,
        signal,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emit({ type: "error", source: "RUNNER", keyword: "INIT", message });
    } finally {
      running = false;
      endedAt = Date.now();
      abortController = null;
    }
  })();

  return true;
}

export function stopScrapeJob(): boolean {
  if (!running || !abortController) return false;
  abortController.abort();
  return true;
}
