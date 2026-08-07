"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { JobSource, JobStatusValue } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { ScrapeResult } from "@/scraper/runner";

export async function setJobStatus(jobId: string, status: JobStatusValue) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  await prisma.jobStatus.upsert({
    where: { userId_jobId: { userId: session.user.id, jobId } },
    create: { userId: session.user.id, jobId, status },
    update: { status },
  });

  revalidatePath("/");
}

// Dev-only manual scrape trigger — real scraping (network calls to
// Computrabajo/ZonaJobs/Reddit) has no place behind a button anyone can click
// in production, so this refuses to run outside `next dev`.
export async function runScrapeNow(): Promise<ScrapeResult[]> {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Scraping is only available in development");
  }

  const { runScrapers } = await import("@/scraper/runner");
  const { scrapeReddit } = await import("@/scraper/sources/reddit");
  const { scrapeComputrabajo } = await import("@/scraper/sources/computrabajo");
  const { scrapeZonajobs } = await import("@/scraper/sources/zonajobs");

  const results = await runScrapers({
    [JobSource.REDDIT]: scrapeReddit,
    [JobSource.COMPUTRABAJO]: scrapeComputrabajo,
    [JobSource.ZONAJOBS]: scrapeZonajobs,
  });

  revalidatePath("/");
  return results;
}
