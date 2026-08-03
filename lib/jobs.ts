import { prisma } from "@/lib/prisma";
import type { JobSource } from "@prisma/client";

export type JobFilters = {
  source?: JobSource;
  keyword?: string;
  search?: string;
  sort?: "recent" | "oldest";
  userId?: string;
};

export async function getJobs(filters: JobFilters = {}) {
  return prisma.job.findMany({
    where: {
      source: filters.source,
      keywordMatched: filters.keyword,
      title: filters.search
        ? { contains: filters.search, mode: "insensitive" }
        : undefined,
    },
    orderBy: { postedAt: filters.sort === "oldest" ? "asc" : "desc" },
    include: {
      statuses: { where: { userId: filters.userId ?? "" } },
    },
  });
}
