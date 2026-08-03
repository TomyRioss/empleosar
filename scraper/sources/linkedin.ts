import { chromium } from "playwright";
import path from "path";
import type { RawJob, SourceScraper } from "../types";

const SESSION_DIR = path.join(__dirname, "..", ".session");

/**
 * Requires a logged-in session persisted at scraper/.session/ — run
 * `npx tsx scraper/login-linkedin.ts` once and log in manually first.
 * Without it, this throws (no results silently); the runner isolates the
 * failure per-source. LinkedIn's DOM/selectors drift over time — this is
 * the source most likely to need maintenance.
 */
export const scrapeLinkedin: SourceScraper = async (keyword) => {
  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: true,
  });

  try {
    const page = await context.newPage();
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      keyword,
    )}&location=Argentina`;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    if (page.url().includes("/login") || page.url().includes("/authwall")) {
      throw new Error("LinkedIn session missing or expired — run scraper/login-linkedin.ts");
    }

    await page.waitForSelector("li[data-occludable-job-id]", { timeout: 15000 });
    const cards = await page.$$("li[data-occludable-job-id]");
    const jobs: RawJob[] = [];

    for (const card of cards) {
      const link = await card
        .$eval("a.job-card-list__title", (el) => (el as HTMLAnchorElement).href)
        .catch(() => null);
      if (!link) continue;

      const idMatch = link.match(/\/jobs\/view\/(\d+)/);
      const externalId = idMatch?.[1];
      if (!externalId) continue;

      const title = await card
        .$eval("a.job-card-list__title", (el) => el.textContent?.trim() ?? "")
        .catch(() => "");
      const company = await card
        .$eval(".job-card-container__company-name", (el) => el.textContent?.trim())
        .catch(() => undefined);

      if (!title) continue;

      jobs.push({ externalId, title, company: company || undefined, url: link });
    }

    return jobs;
  } finally {
    await context.close();
  }
};
