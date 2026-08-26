import { prisma } from "../lib/prisma";
import { JobSource } from "@prisma/client";
import type { RawJob, ScraperSession, SourceScraper } from "./types";

export type ScrapeResult = {
  source: JobSource;
  keyword: string;
  count: number;
  created: number;
  connected: number;
  error?: string;
};

export type LogEntry =
  | { type: "start"; message: string }
  | { type: "progress"; source: string; keyword: string; found: number; created: number; connected: number }
  | { type: "error"; source: string; keyword: string; message: string }
  | { type: "complete"; totalCreated: number; totalConnected: number; stopped?: boolean };

const KEYWORD_TIMEOUT_MS = 90_000;
const DISPOSE_TIMEOUT_MS = 15_000;
const DESCRIPTION_TIMEOUT_MS = 20_000;
const DESCRIPTION_CONCURRENCY = 3;
const MAX_JOB_AGE_MS = 3 * 24 * 60 * 60 * 1000;

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const item = items[index++];
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// Job has no onDelete cascade to JobStatus/JobKeyword/GeneratedCv, so children
// must be purged before the parent row.
export async function purgeOldJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - MAX_JOB_AGE_MS);
  const stale = await prisma.job.findMany({
    where: { scrapedAt: { lt: cutoff } },
    select: { id: true },
  });
  if (stale.length === 0) return 0;

  const ids = stale.map((j) => j.id);
  await prisma.jobStatus.deleteMany({ where: { jobId: { in: ids } } });
  await prisma.jobKeyword.deleteMany({ where: { jobId: { in: ids } } });
  await prisma.generatedCv.deleteMany({ where: { jobId: { in: ids } } });
  await prisma.job.deleteMany({ where: { id: { in: ids } } });
  return ids.length;
}

// A hung page.goto/evaluate (dead browser, stalled connection) has no
// timeout of its own and would otherwise stall the whole source's keyword
// queue forever. Race it against a hard deadline so the run always finishes.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s: ${label}`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// Batches DB writes for one (source, keyword) scrape result: one findMany to
// see what already exists, one createMany for new jobs, one createMany to
// connect keywords — instead of a find+create per individual job.
async function persistJobs(
  source: JobSource,
  keywordId: string,
  rawJobs: RawJob[],
): Promise<{ created: number; connected: number; createdRows: { id: string; url: string }[] }> {
  if (rawJobs.length === 0) return { created: 0, connected: 0, createdRows: [] };

  const externalIds = rawJobs.map((j) => j.externalId);
  const existing = await prisma.job.findMany({
    where: { source, externalId: { in: externalIds } },
    select: { id: true, externalId: true, keywords: { where: { keywordId }, select: { jobId: true } } },
  });
  const existingByExternalId = new Map(existing.map((j) => [j.externalId, j]));

  const newJobs = rawJobs.filter((j) => !existingByExternalId.has(j.externalId));
  const toConnect = existing.filter((j) => j.keywords.length === 0);

  let created = 0;
  let createdRows: { id: string; url: string }[] = [];

  if (newJobs.length > 0) {
    createdRows = await prisma.job.createManyAndReturn({
      data: newJobs.map((j) => ({
        source,
        externalId: j.externalId,
        title: j.title,
        company: j.company,
        url: j.url,
        location: j.location,
        postedAt: j.postedAt,
      })),
      skipDuplicates: true,
      select: { id: true, url: true },
    });
    created = createdRows.length;

    if (createdRows.length > 0) {
      await prisma.jobKeyword.createMany({
        data: createdRows.map((j) => ({ jobId: j.id, keywordId })),
        skipDuplicates: true,
      });
    }
  }

  if (toConnect.length > 0) {
    await prisma.jobKeyword.createMany({
      data: toConnect.map((j) => ({ jobId: j.id, keywordId })),
      skipDuplicates: true,
    });
  }

  return { created, connected: toConnect.length, createdRows };
}

// Best-effort: a job that fails to yield a description just stays without
// one (visible on the detail page as "sin descripción"), never blocks the run.
async function fetchDescriptionsForNewJobs(
  session: ScraperSession,
  createdRows: { id: string; url: string }[],
): Promise<void> {
  await mapWithConcurrency(createdRows, DESCRIPTION_CONCURRENCY, async (job) => {
    try {
      const description = await withTimeout(
        session.fetchDescription(job.url),
        DESCRIPTION_TIMEOUT_MS,
        `description ${job.url}`,
      );
      if (description) {
        await prisma.job.update({ where: { id: job.id }, data: { description } });
      }
    } catch {
      // swallow — description is best-effort, not worth failing the scrape over
    }
  });
}

const SHARD_SLOT_MS = 900_000;

type KeywordRow = Awaited<ReturnType<typeof prisma.keyword.findMany>>[number];

function selectKeywordShard(keywords: KeywordRow[]): { keywords: KeywordRow[]; label: string } {
  const count = Number(process.env.SCRAPE_SHARD_COUNT);
  if (!Number.isInteger(count) || count < 2) return { keywords, label: "" };
  const explicit = Number(process.env.SCRAPE_SHARD_INDEX);
  const index = Number.isInteger(explicit) && explicit >= 0 && explicit < count
    ? explicit
    : Math.floor(Date.now() / SHARD_SLOT_MS) % count;
  return {
    keywords: keywords.filter((_, i) => i % count === index),
    label: ` (shard ${index + 1}/${count})`,
  };
}

export async function runScrapers(
  sources: Partial<Record<JobSource, SourceScraper>>,
  onLog?: (entry: LogEntry) => void | Promise<void>,
  signal?: AbortSignal,
): Promise<ScrapeResult[]> {
  const allKeywords = await prisma.keyword.findMany({ where: { active: true } });
  const { keywords, label } = selectKeywordShard(allKeywords);
  const results: ScrapeResult[] = [];

  const log = (entry: LogEntry) => {
    if (onLog) onLog(entry);
  };

  const sourceEntries = Object.entries(sources) as [JobSource, SourceScraper][];
  log({
    type: "start",
    message: `Scrape${label}: ${keywords.length} of ${allKeywords.length} keywords across ${sourceEntries.length} sources`,
  });

  const run = await prisma.scrapeRun
    .create({ data: { shard: label || null } })
    .catch(() => null);

  // Each source opens one session (e.g. one browser launch) reused across all
  // its keywords, and runs its keyword queue sequentially within that session
  // — but sources run in parallel with each other.
  const runSource = async (source: JobSource, createScraper: SourceScraper) => {
    const session = await createScraper();
    let consecutiveFailures = 0;
    try {
      for (const { id: keywordId, term } of keywords) {
        if (signal?.aborted) return;

        try {
          const rawJobs = await withTimeout(session.scrape(term), KEYWORD_TIMEOUT_MS, `${source} ${term}`);
          const { created, connected, createdRows } = await persistJobs(source, keywordId, rawJobs);
          await fetchDescriptionsForNewJobs(session, createdRows);

          consecutiveFailures = 0;
          log({ type: "progress", source, keyword: term, found: rawJobs.length, created, connected });
          results.push({ source, keyword: term, count: rawJobs.length, created, connected });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log({ type: "error", source, keyword: term, message });
          results.push({ source, keyword: term, count: 0, created: 0, connected: 0, error: message });

          consecutiveFailures++;
          if (consecutiveFailures >= 3) {
            log({
              type: "error",
              source,
              keyword: "ABORT",
              message: `${consecutiveFailures} consecutive failures — bailing out of ${source} early`,
            });
            return;
          }
        }
      }
    } finally {
      await withTimeout(session.dispose(), DISPOSE_TIMEOUT_MS, `dispose ${source}`).catch(() => {});
    }
  };

  await Promise.all(sourceEntries.map(([source, createScraper]) => runSource(source, createScraper)));

  const purged = await purgeOldJobs();
  if (purged > 0) {
    log({ type: "start", message: `Purged ${purged} job(s) older than 3 days` });
  }

  const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
  const totalConnected = results.reduce((sum, r) => sum + r.connected, 0);
  log({
    type: "complete",
    totalCreated,
    totalConnected,
    stopped: signal?.aborted ?? false,
  });

  if (run) {
    await prisma.scrapeRun
      .update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          totalFound: results.reduce((sum, r) => sum + r.count, 0),
          totalCreated,
          totalConnected,
        },
      })
      .catch(() => {});
  }

  return results;
}
