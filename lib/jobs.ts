import { prisma } from "@/lib/prisma";
import type { JobSource } from "@prisma/client";

export type JobFilters = {
  source?: JobSource;
  keyword?: string;
  search?: string;
  location?: string;
  sort?: "recent" | "oldest";
  userId?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 25;

export async function getJobs(filters: JobFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE);

  return prisma.job.findMany({
    where: {
      source: filters.source,
      title: filters.search
        ? { contains: filters.search, mode: "insensitive" }
        : undefined,
      location: filters.location
        ? { contains: filters.location, mode: "insensitive" }
        : undefined,
      keywords: filters.keyword
        ? { some: { keyword: { term: filters.keyword } } }
        : undefined,
    },
    orderBy: {
      postedAt:
        filters.sort === "oldest"
          ? { sort: "asc", nulls: "last" }
          : { sort: "desc", nulls: "last" },
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      statuses: { where: { userId: filters.userId ?? "" } },
      keywords: { include: { keyword: true } },
    },
  });
}

export async function getJobCount(filters: Omit<JobFilters, "sort" | "userId" | "page" | "pageSize"> = {}) {
  return prisma.job.count({
    where: {
      source: filters.source,
      title: filters.search
        ? { contains: filters.search, mode: "insensitive" }
        : undefined,
      location: filters.location
        ? { contains: filters.location, mode: "insensitive" }
        : undefined,
      keywords: filters.keyword
        ? { some: { keyword: { term: filters.keyword } } }
        : undefined,
    },
  });
}

export async function getLastScrapedAt() {
  const run = await prisma.scrapeRun.findFirst({
    where: { finishedAt: { not: null } },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true },
  });
  if (run?.finishedAt) return run.finishedAt;
  const result = await prisma.job.aggregate({
    _max: { scrapedAt: true },
  });
  return result._max.scrapedAt;
}
