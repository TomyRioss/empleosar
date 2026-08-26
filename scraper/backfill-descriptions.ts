import { config } from "dotenv";
config({ path: ".env.local" });

import { JobSource } from "@prisma/client";
import type { SourceScraper } from "./types";
import type { PrismaClient } from "@prisma/client";

const CONCURRENCY: Record<JobSource, number> = {
  COMPUTRABAJO: 8,
  ZONAJOBS: 3,
  REDDIT: 2,
  LINKEDIN: 3,
};

const BATCH_SIZE = 200;

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

async function backfillSource(prisma: PrismaClient, source: JobSource, createScraper: SourceScraper) {
  const total = await prisma.job.count({ where: { source, description: null } });
  if (total === 0) {
    console.log(`[${source}] nothing to backfill`);
    return;
  }
  console.log(`[${source}] backfilling ${total} jobs...`);

  const session = await createScraper();
  let done = 0;
  let failed = 0;

  try {
    while (true) {
      const batch = await prisma.job.findMany({
        where: { source, description: null },
        select: { id: true, url: true },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;

      await mapWithConcurrency(batch, CONCURRENCY[source], async (job) => {
        try {
          const description = await session.fetchDescription(job.url);
          await prisma.job.update({
            where: { id: job.id },
            // Empty string marks "checked, nothing found" so it isn't retried forever.
            data: { description: description || "" },
          });
          done++;
        } catch (err) {
          failed++;
          console.error(`[${source}] failed ${job.url}: ${err instanceof Error ? err.message : err}`);
          // Mark as checked even on failure so a bad URL doesn't loop forever;
          // re-run the script later to retry rows still worth another attempt.
          await prisma.job.update({ where: { id: job.id }, data: { description: "" } }).catch(() => {});
        }
      });

      console.log(`[${source}] ${done + failed}/${total} processed (${failed} failed)`);
    }
  } finally {
    await session.dispose();
  }

  console.log(`[${source}] done: ${done} ok, ${failed} failed`);
}

// Dynamic imports: lib/prisma.ts reads process.env.DATABASE_URL at module
// evaluation time, and static imports get hoisted above the config() call
// above by the bundler, so a static import here would see an empty env.
async function main() {
  const { prisma } = await import("../lib/prisma");
  const { scrapeReddit } = await import("./sources/reddit");
  const { scrapeComputrabajo } = await import("./sources/computrabajo");
  const { scrapeZonajobs } = await import("./sources/zonajobs");

  const sourceScrapers: Partial<Record<JobSource, SourceScraper>> = {
    COMPUTRABAJO: scrapeComputrabajo,
    ZONAJOBS: scrapeZonajobs,
    REDDIT: scrapeReddit,
  };

  for (const [source, createScraper] of Object.entries(sourceScrapers) as [JobSource, SourceScraper][]) {
    await backfillSource(prisma, source, createScraper);
  }
  console.log("Backfill complete.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal backfill error:", err);
  process.exit(1);
});
