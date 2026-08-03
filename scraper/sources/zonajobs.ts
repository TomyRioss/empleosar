import { chromium } from "playwright";
import * as cheerio from "cheerio";
import type { RawJob, SourceScraper } from "../types";

/**
 * ZonaJobs sits behind Cloudflare's bot challenge (verified: even a real
 * headless Chromium gets the "Attention Required" interstitial, not the
 * search results). This will throw on every run until that's solved
 * (stealth/proxy setup, out of scope here) — the runner isolates the
 * failure per-source, so it doesn't block Reddit/Computrabajo.
 */
export const scrapeZonajobs: SourceScraper = async (keyword) => {
  const url = `https://www.zonajobs.com.ar/empleos-busqueda-${encodeURIComponent(
    keyword.trim().replace(/\s+/g, "-"),
  )}.html`;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    const title = await page.title();
    if (title.includes("Attention Required") || title.includes("Cloudflare")) {
      throw new Error("ZonaJobs blocked the request (Cloudflare challenge)");
    }

    const html = await page.content();
    const $ = cheerio.load(html);
    const jobs: RawJob[] = [];

    $("[data-testid='result-item']").each((_, el) => {
      const link = $(el).find("a").first();
      const href = link.attr("href");
      if (!href) return;

      const externalId = href.split("/").pop()?.replace(".html", "") ?? href;

      jobs.push({
        externalId,
        title: $(el).find("h2, h3").first().text().trim(),
        company: $(el).find("[data-testid='company-name']").first().text().trim() || undefined,
        location: $(el).find("[data-testid='job-location']").first().text().trim() || undefined,
        url: href.startsWith("http") ? href : `https://www.zonajobs.com.ar${href}`,
      });
    });

    return jobs;
  } finally {
    await browser.close();
  }
};
