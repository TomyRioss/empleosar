import * as cheerio from "cheerio";
import type { RawJob, ScraperSession, SourceScraper } from "../types";
import { parseRelativeDate } from "../parse-date";

const MAX_PAGES = 10;
const PAGE_BATCH = 2;

async function fetchPage(url: string): Promise<RawJob[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) trabajoteca-hub/1.0" },
  });

  if (!res.ok) {
    if (res.status === 404) return []; // No more pages
    throw new Error(`Computrabajo request failed: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const pageJobs: RawJob[] = [];

  $("article.box_offer").each((_, el) => {
    const externalId = $(el).attr("data-id");
    const titleLink = $(el).find("h2 a.js-o-link").first();
    const href = titleLink.attr("href");
    if (!externalId || !href) return;

    const company = $(el).find("a[offer-grid-article-company-url]").first().text().trim();
    const location = $(el).find("p.fs16.fc_base.mt5").eq(1).find("span.mr10").first().text().trim();

    const dateText = $(el)
      .find("p, span, div")
      .toArray()
      .map((e) => $(e).text().trim())
      .find((t) => /hace\s/i.test(t)) || "";

    pageJobs.push({
      externalId,
      title: titleLink.text().trim(),
      company: company || undefined,
      location: location || undefined,
      url: href.startsWith("http") ? href : `https://ar.computrabajo.com${href}`,
      postedAt: parseRelativeDate(dateText),
    });
  });

  return pageJobs;
}

/**
 * Plain HTTP + cheerio, no browser needed. Pages are fetched two at a time
 * (PAGE_BATCH) instead of one-by-one — halves the wall-clock time spent
 * waiting on network round-trips. Pagination stops as soon as any page in a
 * batch comes back empty (may fetch one extra page beyond the real end, which
 * is cheap and harmless).
 */
export const scrapeComputrabajo: SourceScraper = async (): Promise<ScraperSession> => ({
  scrape: async (keyword: string): Promise<RawJob[]> => {
    const allJobs: RawJob[] = [];
    const slug = encodeURIComponent(keyword.trim().replace(/\s+/g, "-"));
    const baseUrl = `https://ar.computrabajo.com/trabajo-de-${slug}`;
    const urlForPage = (page: number) => (page === 1 ? baseUrl : `${baseUrl}?p=${page}`);

    let page = 1;
    while (page <= MAX_PAGES) {
      const batch = Array.from(
        { length: Math.min(PAGE_BATCH, MAX_PAGES - page + 1) },
        (_, i) => page + i,
      );
      const batchResults = await Promise.all(batch.map((p) => fetchPage(urlForPage(p))));

      let hitEmpty = false;
      for (const pageJobs of batchResults) {
        if (pageJobs.length === 0) {
          hitEmpty = true;
          break;
        }
        allJobs.push(...pageJobs);
      }

      if (hitEmpty) break;
      page += batch.length;
    }

    return allJobs;
  },
  dispose: async () => {},
});
