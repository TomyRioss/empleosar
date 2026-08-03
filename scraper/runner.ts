import { prisma } from "../lib/prisma";
import { JobSource } from "@prisma/client";
import type { SourceScraper } from "./types";

export type ScrapeResult = {
  source: JobSource;
  keyword: string;
  count: number;
  error?: string;
};

export async function runScrapers(
  sources: Partial<Record<JobSource, SourceScraper>>,
): Promise<ScrapeResult[]> {
  const keywords = await prisma.keyword.findMany({ where: { active: true } });
  const results: ScrapeResult[] = [];

  for (const { term } of keywords) {
    for (const [source, scrape] of Object.entries(sources) as [JobSource, SourceScraper][]) {
      try {
        const rawJobs = await scrape(term);
        for (const rawJob of rawJobs) {
          await prisma.job.upsert({
            where: { source_externalId: { source, externalId: rawJob.externalId } },
            create: {
              source,
              externalId: rawJob.externalId,
              title: rawJob.title,
              company: rawJob.company,
              url: rawJob.url,
              location: rawJob.location,
              postedAt: rawJob.postedAt,
              keywordMatched: term,
            },
            update: {
              title: rawJob.title,
              company: rawJob.company,
              location: rawJob.location,
              postedAt: rawJob.postedAt,
            },
          });
        }
        results.push({ source, keyword: term, count: rawJobs.length });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[scraper] ${source} failed for keyword "${term}":`, message);
        results.push({ source, keyword: term, count: 0, error: message });
      }
    }
  }

  return results;
}
