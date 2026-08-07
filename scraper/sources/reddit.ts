import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { RawJob, ScraperSession, SourceScraper } from "../types";

chromium.use(StealthPlugin());

type RawPost = {
  thingId: string | null;
  href: string | null;
  title: string | null;
  timestamp: string | null;
};

const SCROLL_CYCLES = 4;

/**
 * Reddit's public .json search endpoint 403s from this environment (IP-level
 * bot block), and a plain headless browser gets stuck in Reddit's own JS
 * proof-of-work challenge loop. A stealth-patched browser (playwright-extra +
 * puppeteer-extra-plugin-stealth) gets past both and loads the real search
 * results page.
 *
 * One browser is launched per run and reused across every keyword (a new
 * page per keyword) — launching a fresh browser per keyword was the single
 * biggest fixed cost in the scrape run.
 */
export const scrapeReddit: SourceScraper = async (): Promise<ScraperSession> => {
  const browser = await chromium.launch({ headless: true });

  return {
    scrape: async (keyword: string): Promise<RawJob[]> => {
      const page = await browser.newPage();
      try {
        const url = `https://www.reddit.com/r/empleos/search/?q=${encodeURIComponent(
          keyword,
        )}&restrict_sr=1&sort=new`;

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(6000);

        // Scroll to trigger Reddit's infinite scroll for more posts
        for (let i = 0; i < SCROLL_CYCLES; i++) {
          await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
          await page.waitForTimeout(2000);
        }

        const posts = await page.$$eval(
          'search-telemetry-tracker[data-testid="search-sdui-post"]',
          (els) =>
            els.map((el) => {
              const link = el.querySelector('a[data-testid="post-title-text"]');
              const timeago = el.querySelector("faceplate-timeago");
              return {
                thingId: el.getAttribute("data-thingid"),
                href: link?.getAttribute("href") ?? null,
                title: link?.textContent?.trim() ?? null,
                timestamp: timeago?.getAttribute("ts") ?? null,
              };
            }),
        );

        return posts
          .filter((p: RawPost) => p.thingId && p.href && p.title)
          .map(
            (p: RawPost): RawJob => ({
              externalId: (p.thingId as string).replace(/^t3_/, ""),
              title: p.title as string,
              url: `https://www.reddit.com${p.href}`,
              postedAt: p.timestamp ? new Date(p.timestamp) : undefined,
            }),
          );
      } finally {
        await page.close();
      }
    },
    dispose: async () => {
      await browser.close();
    },
  };
};
