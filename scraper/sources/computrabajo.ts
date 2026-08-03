import * as cheerio from "cheerio";
import type { RawJob, SourceScraper } from "../types";

export const scrapeComputrabajo: SourceScraper = async (keyword) => {
  const url = `https://ar.computrabajo.com/trabajo-de-${encodeURIComponent(
    keyword.trim().replace(/\s+/g, "-"),
  )}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) trabajoteca-hub/1.0" },
  });

  if (!res.ok) {
    throw new Error(`Computrabajo request failed: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const jobs: RawJob[] = [];

  $("article.box_offer").each((_, el) => {
    const externalId = $(el).attr("data-id");
    const titleLink = $(el).find("h2 a.js-o-link").first();
    const href = titleLink.attr("href");
    if (!externalId || !href) return;

    const company = $(el).find("a[offer-grid-article-company-url]").first().text().trim();
    const location = $(el).find("p.fs16.fc_base.mt5").eq(1).find("span.mr10").first().text().trim();

    jobs.push({
      externalId,
      title: titleLink.text().trim(),
      company: company || undefined,
      location: location || undefined,
      url: href.startsWith("http") ? href : `https://ar.computrabajo.com${href}`,
    });
  });

  return jobs;
};
