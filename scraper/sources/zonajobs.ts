import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as cheerio from "cheerio";
import type { RawJob, ScraperSession, SourceScraper } from "../types";
import { parseRelativeDate } from "../parse-date";
import { htmlToText } from "../html-to-text";

chromium.use(StealthPlugin());

const MAX_PAGES = 8;

/**
 * ZonaJobs sits behind Cloudflare's bot challenge for a plain headless
 * browser. A stealth-patched browser (playwright-extra +
 * puppeteer-extra-plugin-stealth) gets past it and loads the real listing.
 * `?recientes=true` sorts results by most recent (vs. the default
 * "Relevantes" relevance sort).
 *
 * One browser is launched per run and reused across every keyword (a new
 * page per keyword) — launching a fresh browser per keyword was the single
 * biggest fixed cost in the scrape run.
 */
export const scrapeZonajobs: SourceScraper = async (): Promise<ScraperSession> => {
  const browser = await chromium.launch({ headless: true });

  return {
    scrape: async (keyword: string): Promise<RawJob[]> => {
      const allJobs: RawJob[] = [];
      const slug = encodeURIComponent(keyword.trim().replace(/\s+/g, "-"));
      const page = await browser.newPage();

      try {
        for (let p = 1; p <= MAX_PAGES; p++) {
          const url =
            p === 1
              ? `https://www.zonajobs.com.ar/empleos-busqueda-${slug}.html?recientes=true`
              : `https://www.zonajobs.com.ar/empleos-busqueda-${slug}.html?recientes=true&pagina=${p}`;

          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(6000);

          const title = await page.title();
          if (title.includes("Attention") || title.includes("Cloudflare") || title === "") {
            throw new Error("ZonaJobs blocked the request");
          }

          const html = await page.content();
          const $ = cheerio.load(html);
          const pageJobs: RawJob[] = [];

          $('a[href^="/empleos/"][target="_blank"]').each((_, el) => {
            const href = $(el).attr("href");
            const idMatch = href?.match(/-(\d+)\.html$/);
            const externalId = idMatch?.[1];
            if (!externalId) return;

            const jobTitle = $(el).find("h2").first().text().trim();
            if (!jobTitle) return;

            const company = $(el)
              .find("h3")
              .filter((_i, h3) => !$(h3).text().startsWith("Publicado"))
              .first()
              .text()
              .trim();

            const dateText = $(el)
              .find("h3")
              .filter((_i, h3) => $(h3).text().startsWith("Publicado"))
              .first()
              .text()
              .trim();

            const location = $(el)
              .find('i[aria-label="Ubicación"]')
              .closest("div")
              .find("span h3")
              .first()
              .text()
              .trim();

            pageJobs.push({
              externalId,
              title: jobTitle,
              company: company || undefined,
              location: location || undefined,
              url: `https://www.zonajobs.com.ar${href}`,
              postedAt: parseRelativeDate(dateText),
            });
          });

          if (pageJobs.length === 0) break;
          allJobs.push(...pageJobs);
        }

        return allJobs;
      } finally {
        await page.close();
      }
    },
    // The detail page embeds a non-standard ld+json blob shaped like
    // {title, description} — description is an HTML fragment, not schema.org.
    fetchDescription: async (url: string): Promise<string | undefined> => {
      const page = await browser.newPage();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(3000);

        const html = await page.content();
        const $ = cheerio.load(html);
        let description: string | undefined;

        $('script[type="application/ld+json"]').each((_, el) => {
          if (description) return;
          try {
            const data = JSON.parse($(el).html() ?? "");
            if (typeof data?.description === "string") description = data.description;
          } catch {
            // Not every ld+json block on the page is this shape; skip malformed ones.
          }
        });

        return description ? htmlToText(description) : undefined;
      } finally {
        await page.close();
      }
    },
    dispose: async () => {
      await browser.close();
    },
  };
};
