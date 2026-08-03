"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { JobSource, JobStatusValue } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { runScrapers, type ScrapeResult } from "@/scraper/runner";
import { scrapeReddit } from "@/scraper/sources/reddit";
import { scrapeComputrabajo } from "@/scraper/sources/computrabajo";
import { scrapeZonajobs } from "@/scraper/sources/zonajobs";
import { scrapeLinkedin } from "@/scraper/sources/linkedin";

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

// Dev-only manual scrape trigger — real scraping (network calls to LinkedIn/
// Computrabajo/ZonaJobs/Reddit) has no place behind a button anyone can click
// in production, so this refuses to run outside `next dev`.
export async function runScrapeNow(): Promise<ScrapeResult[]> {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Scraping is only available in development");
  }

  const results = await runScrapers({
    [JobSource.REDDIT]: scrapeReddit,
    [JobSource.COMPUTRABAJO]: scrapeComputrabajo,
    [JobSource.ZONAJOBS]: scrapeZonajobs,
    [JobSource.LINKEDIN]: scrapeLinkedin,
  });

  revalidatePath("/");
  return results;
}
