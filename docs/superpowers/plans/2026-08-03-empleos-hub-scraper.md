# Empleos Hub — Scraper (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standalone Node script (`scraper/`) that, for each active `Keyword`, pulls listings from Reddit r/empleos, Computrabajo, ZonaJobs, and LinkedIn Empleos, and upserts them into the `Job` table — run manually or via local cron, isolated so one source failing doesn't stop the others.

**Architecture:** One module per source exposing `scrape(keyword: string): Promise<RawJob[]>`, a shared `RawJob` type, and a runner that iterates `Keyword × Source`, normalizes, and upserts via the same Prisma client used by the hub. LinkedIn uses Playwright (needs a real logged-in session); Reddit uses its public JSON endpoint; Computrabajo/ZonaJobs use `fetch` + `cheerio`.

**Tech Stack:** Node (same repo, TypeScript via `tsx`), Prisma (shared `lib/prisma.ts` from Plan A), `cheerio`, `playwright`.

## Global Constraints

- Requires Plan A (`docs/superpowers/plans/2026-08-03-empleos-hub-foundation.md`) done first — needs `lib/prisma.ts`, the `Job`/`Keyword` schema, and at least one seeded keyword to test against.
- Runs out-of-process from the Next.js app (local cron), not a Vercel Cron / API route — per spec decision.
- Each source module fails independently: a thrown error in one source is caught and logged by the runner, the run continues with the next source/keyword.
- `externalId` must be stable across runs of the same listing (native id when the source exposes one, otherwise a hash of `url`) — this is what dedupe depends on via `@@unique([source, externalId])`.
- LinkedIn session cookies are secrets — stored outside git (`scraper/.session/`, added to `.gitignore`), never committed.

---

### Task 1: Shared types + runner skeleton

**Files:**
- Create: `scraper/types.ts`
- Create: `scraper/runner.ts`
- Modify: `.gitignore` (add `scraper/.session/`)
- Test: `scraper/runner.test.ts`

**Interfaces:**
- Produces: `RawJob` type (`{ externalId: string; title: string; company?: string; url: string; location?: string; postedAt?: Date }`), `SourceScraper` type (`(keyword: string) => Promise<RawJob[]>`), `runScrapers(sources: Record<JobSource, SourceScraper>): Promise<void>` — orchestrates keyword × source, upserts, isolates failures. This is what Tasks 2-5 plug their scrapers into.

- [ ] **Step 1: Install test runner and shared deps**

```bash
npm install -D vitest cheerio
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write `scraper/types.ts`**

```ts
export type RawJob = {
  externalId: string;
  title: string;
  company?: string;
  url: string;
  location?: string;
  postedAt?: Date;
};

export type SourceScraper = (keyword: string) => Promise<RawJob[]>;
```

- [ ] **Step 3: Write the failing test for the runner**

`scraper/runner.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runScrapers } from "./runner";
import { prisma } from "../lib/prisma";
import { JobSource } from "@prisma/client";

vi.mock("../lib/prisma", () => ({
  prisma: {
    keyword: { findMany: vi.fn() },
    job: { upsert: vi.fn() },
  },
}));

describe("runScrapers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts jobs from a working source and skips a failing one without throwing", async () => {
    (prisma.keyword.findMany as any).mockResolvedValue([{ term: "react" }]);

    const working = vi.fn().mockResolvedValue([
      { externalId: "1", title: "Dev", url: "https://x.com/1" },
    ]);
    const failing = vi.fn().mockRejectedValue(new Error("site down"));

    await runScrapers({
      [JobSource.REDDIT]: working,
      [JobSource.LINKEDIN]: failing,
    } as any);

    expect(prisma.job.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.job.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source_externalId: { source: JobSource.REDDIT, externalId: "1" } },
      })
    );
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run scraper/runner.test.ts`
Expected: FAIL — `runner.ts` does not exist / `runScrapers` not exported.

- [ ] **Step 5: Implement the runner**

`scraper/runner.ts`:

```ts
import { prisma } from "../lib/prisma";
import { JobSource } from "@prisma/client";
import type { SourceScraper } from "./types";

export async function runScrapers(sources: Partial<Record<JobSource, SourceScraper>>) {
  const keywords = await prisma.keyword.findMany({ where: { active: true } });

  for (const { term } of keywords) {
    for (const [source, scrape] of Object.entries(sources) as [JobSource, SourceScraper][]) {
      try {
        const rawJobs = await scrape(term);
        for (const rawJob of rawJobs) {
          await prisma.job.upsert({
            where: { source_externalId: { source, externalId: rawJob.externalId } },
            create: {
              source,
              externalId: rawJob.externalId,
              title: rawJob.title,
              company: rawJob.company,
              url: rawJob.url,
              location: rawJob.location,
              postedAt: rawJob.postedAt,
              keywordMatched: term,
            },
            update: {
              title: rawJob.title,
              company: rawJob.company,
              location: rawJob.location,
              postedAt: rawJob.postedAt,
            },
          });
        }
      } catch (err) {
        console.error(`[scraper] ${source} failed for keyword "${term}":`, err);
      }
    }
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run scraper/runner.test.ts`
Expected: PASS.

- [ ] **Step 7: Ignore session dir + commit**

Add `scraper/.session/` to `.gitignore`.

```bash
git add scraper/types.ts scraper/runner.ts scraper/runner.test.ts .gitignore package.json package-lock.json
git commit -m "feat: add scraper runner with per-source failure isolation"
```

---

### Task 2: Reddit r/empleos scraper

**Files:**
- Create: `scraper/sources/reddit.ts`
- Test: `scraper/sources/reddit.test.ts`

**Interfaces:**
- Consumes: `RawJob`, `SourceScraper` from `scraper/types.ts`.
- Produces: `scrapeReddit: SourceScraper`, plugged into the runner as `sources[JobSource.REDDIT]` in Task 5.

- [ ] **Step 1: Write the failing test**

`scraper/sources/reddit.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { scrapeReddit } from "./reddit";

const mockResponse = {
  data: {
    children: [
      {
        data: {
          id: "abc123",
          title: "Busco dev react remoto",
          permalink: "/r/empleos/comments/abc123/busco_dev/",
          created_utc: 1700000000,
        },
      },
    ],
  },
};

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockResponse,
  } as Response);
});

describe("scrapeReddit", () => {
  it("maps Reddit posts to RawJob", async () => {
    const jobs = await scrapeReddit("react");

    expect(jobs).toEqual([
      {
        externalId: "abc123",
        title: "Busco dev react remoto",
        url: "https://www.reddit.com/r/empleos/comments/abc123/busco_dev/",
        postedAt: new Date(1700000000 * 1000),
      },
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("r/empleos/search.json")
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scraper/sources/reddit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`scraper/sources/reddit.ts`:

```ts
import type { SourceScraper } from "../types";

export const scrapeReddit: SourceScraper = async (keyword) => {
  const url = `https://www.reddit.com/r/empleos/search.json?q=${encodeURIComponent(
    keyword
  )}&restrict_sr=1&sort=new`;

  const res = await fetch(url, {
    headers: { "User-Agent": "trabajoteca-hub/1.0" },
  });

  if (!res.ok) {
    throw new Error(`Reddit request failed: ${res.status}`);
  }

  const json = await res.json();

  return json.data.children.map((child: any) => ({
    externalId: child.data.id,
    title: child.data.title,
    url: `https://www.reddit.com${child.data.permalink}`,
    postedAt: new Date(child.data.created_utc * 1000),
  }));
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scraper/sources/reddit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scraper/sources/reddit.ts scraper/sources/reddit.test.ts
git commit -m "feat: add Reddit r/empleos scraper"
```

---

### Task 3: Computrabajo scraper

**Files:**
- Create: `scraper/sources/computrabajo.ts`
- Test: `scraper/sources/computrabajo.test.ts`

**Interfaces:**
- Consumes: `RawJob`, `SourceScraper` from `scraper/types.ts`, `cheerio`.
- Produces: `scrapeComputrabajo: SourceScraper`, plugged into runner in Task 5.

- [ ] **Step 1: Write the failing test with a fixture HTML snippet**

`scraper/sources/computrabajo.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { scrapeComputrabajo } from "./computrabajo";

const fixtureHtml = `
<html><body>
  <article class="box_offer">
    <a class="js-o-link" href="/ofertas-de-trabajo/oferta-de-administrativo-123.html">Administrativo contable</a>
    <p class="fs16 fc_base t_word_wrap">Empresa SA</p>
    <p class="fs13"><i class="mr5"></i>Cordoba</p>
  </article>
</body></html>
`;

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: async () => fixtureHtml,
  } as Response);
});

describe("scrapeComputrabajo", () => {
  it("parses listing cards into RawJob", async () => {
    const jobs = await scrapeComputrabajo("administrativo");

    expect(jobs).toEqual([
      {
        externalId: "oferta-de-administrativo-123",
        title: "Administrativo contable",
        company: "Empresa SA",
        url: "https://www.computrabajo.com.ar/ofertas-de-trabajo/oferta-de-administrativo-123.html",
        location: "Cordoba",
      },
    ]);
  });
});
```

Note: the exact CSS selectors above are best-effort based on Computrabajo's typical markup at plan-writing time — **the implementer must load a real Computrabajo search results page in a browser, inspect the actual DOM, and adjust selectors/fixture to match** before trusting this test. Computrabajo's HTML structure is not under our control and may already differ.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scraper/sources/computrabajo.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement (adjust selectors per Step 1 note if the real DOM differs)**

`scraper/sources/computrabajo.ts`:

```ts
import * as cheerio from "cheerio";
import type { SourceScraper } from "../types";

export const scrapeComputrabajo: SourceScraper = async (keyword) => {
  const url = `https://www.computrabajo.com.ar/trabajo-de-${encodeURIComponent(
    keyword.replace(/\s+/g, "-")
  )}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (trabajoteca-hub/1.0)" },
  });

  if (!res.ok) {
    throw new Error(`Computrabajo request failed: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const jobs: ReturnType<SourceScraper> extends Promise<infer T> ? T : never = [];

  $("article.box_offer").each((_, el) => {
    const link = $(el).find("a.js-o-link").first();
    const href = link.attr("href") ?? "";
    const externalId = href.split("/").pop()?.replace(".html", "") ?? "";
    if (!externalId) return;

    jobs.push({
      externalId,
      title: link.text().trim(),
      company: $(el).find("p.fs16.fc_base.t_word_wrap").first().text().trim() || undefined,
      location: $(el).find("p.fs13").first().text().trim() || undefined,
      url: `https://www.computrabajo.com.ar${href}`,
    });
  });

  return jobs;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scraper/sources/computrabajo.test.ts`
Expected: PASS (after confirming/adjusting selectors against the real site per Step 1).

- [ ] **Step 5: Commit**

```bash
git add scraper/sources/computrabajo.ts scraper/sources/computrabajo.test.ts
git commit -m "feat: add Computrabajo scraper"
```

---

### Task 4: ZonaJobs scraper

**Files:**
- Create: `scraper/sources/zonajobs.ts`
- Test: `scraper/sources/zonajobs.test.ts`

**Interfaces:**
- Consumes: `RawJob`, `SourceScraper` from `scraper/types.ts`, `cheerio`.
- Produces: `scrapeZonajobs: SourceScraper`, plugged into runner in Task 5.

- [ ] **Step 1: Write the failing test with a fixture HTML snippet**

`scraper/sources/zonajobs.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { scrapeZonajobs } from "./zonajobs";

const fixtureHtml = `
<html><body>
  <div class="sc-avisos" data-id="987654">
    <a href="/empleos/vendedor-987654.html" class="aviso-title">Vendedor retail</a>
    <span class="aviso-empresa">Retail SA</span>
    <span class="aviso-ubicacion">Rosario</span>
  </div>
</body></html>
`;

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: async () => fixtureHtml,
  } as Response);
});

describe("scrapeZonajobs", () => {
  it("parses listing cards into RawJob", async () => {
    const jobs = await scrapeZonajobs("vendedor");

    expect(jobs).toEqual([
      {
        externalId: "987654",
        title: "Vendedor retail",
        company: "Retail SA",
        location: "Rosario",
        url: "https://www.zonajobs.com.ar/empleos/vendedor-987654.html",
      },
    ]);
  });
});
```

Same caveat as Computrabajo: **verify real ZonaJobs markup in a browser before trusting these selectors.**

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scraper/sources/zonajobs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement (adjust selectors per Step 1 note if the real DOM differs)**

`scraper/sources/zonajobs.ts`:

```ts
import * as cheerio from "cheerio";
import type { SourceScraper } from "../types";

export const scrapeZonajobs: SourceScraper = async (keyword) => {
  const url = `https://www.zonajobs.com.ar/empleos-busqueda-${encodeURIComponent(
    keyword.replace(/\s+/g, "-")
  )}.html`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (trabajoteca-hub/1.0)" },
  });

  if (!res.ok) {
    throw new Error(`ZonaJobs request failed: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const jobs: ReturnType<SourceScraper> extends Promise<infer T> ? T : never = [];

  $("div.sc-avisos").each((_, el) => {
    const externalId = $(el).attr("data-id") ?? "";
    const link = $(el).find("a.aviso-title").first();
    const href = link.attr("href") ?? "";
    if (!externalId || !href) return;

    jobs.push({
      externalId,
      title: link.text().trim(),
      company: $(el).find(".aviso-empresa").first().text().trim() || undefined,
      location: $(el).find(".aviso-ubicacion").first().text().trim() || undefined,
      url: `https://www.zonajobs.com.ar${href}`,
    });
  });

  return jobs;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scraper/sources/zonajobs.test.ts`
Expected: PASS (after confirming/adjusting selectors against the real site per Step 1).

- [ ] **Step 5: Commit**

```bash
git add scraper/sources/zonajobs.ts scraper/sources/zonajobs.test.ts
git commit -m "feat: add ZonaJobs scraper"
```

---

### Task 5: LinkedIn Empleos scraper (Playwright, session-based)

**Files:**
- Create: `scraper/sources/linkedin.ts`
- Create: `scraper/login-linkedin.ts` (one-off manual login script to capture session)
- Test: `scraper/sources/linkedin.test.ts`

**Interfaces:**
- Consumes: `RawJob`, `SourceScraper` from `scraper/types.ts`, `playwright`.
- Produces: `scrapeLinkedin: SourceScraper`, plugged into runner in Task 6.

**This is the most fragile source** — LinkedIn requires an authenticated session and renders results with JS; the DOM/selectors will drift and this scraper will need updates over time. It's isolated by the runner (Task 1) so its failures never block the other 3 sources.

- [ ] **Step 1: Install Playwright**

```bash
npm install -D playwright
npx playwright install chromium
```

- [ ] **Step 2: One-off script to capture a logged-in session**

`scraper/login-linkedin.ts`:

```ts
import { chromium } from "playwright";
import path from "path";

const SESSION_DIR = path.join(__dirname, ".session");

async function main() {
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
  });
  const page = await browser.newPage();
  await page.goto("https://www.linkedin.com/login");

  console.log("Log in manually in the opened browser window, then press Ctrl+C here once logged in.");
  await new Promise(() => {}); // keep process alive until user Ctrl+C's
}

main();
```

Run once manually: `npx tsx scraper/login-linkedin.ts`, log in by hand in the opened Chromium window, then Ctrl+C. This persists cookies to `scraper/.session/` (gitignored per Task 1).

- [ ] **Step 3: Write the failing test**

`scraper/sources/linkedin.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { scrapeLinkedin } from "./linkedin";

vi.mock("playwright", () => {
  const mockJobCards = [
    {
      getAttribute: vi.fn().mockResolvedValue("https://www.linkedin.com/jobs/view/3900000001/"),
      $eval: vi.fn((selector: string) => {
        if (selector.includes("title")) return Promise.resolve("Dev Frontend React");
        if (selector.includes("company")) return Promise.resolve("Tech SA");
        return Promise.resolve("");
      }),
    },
  ];

  const page = {
    goto: vi.fn(),
    waitForSelector: vi.fn(),
    $$: vi.fn().mockResolvedValue(mockJobCards),
  };

  const context = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn() };

  return {
    chromium: {
      launchPersistentContext: vi.fn().mockResolvedValue(context),
    },
  };
});

describe("scrapeLinkedin", () => {
  it("extracts job id from URL and maps card to RawJob", async () => {
    const jobs = await scrapeLinkedin("react");

    expect(jobs).toEqual([
      {
        externalId: "3900000001",
        title: "Dev Frontend React",
        company: "Tech SA",
        url: "https://www.linkedin.com/jobs/view/3900000001/",
      },
    ]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run scraper/sources/linkedin.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement**

`scraper/sources/linkedin.ts`:

```ts
import { chromium } from "playwright";
import path from "path";
import type { SourceScraper } from "../types";

const SESSION_DIR = path.join(__dirname, "..", ".session");

export const scrapeLinkedin: SourceScraper = async (keyword) => {
  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: true,
  });

  try {
    const page = await context.newPage();
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      keyword
    )}&location=Argentina`;

    await page.goto(url);
    await page.waitForSelector("li[data-occludable-job-id]", { timeout: 15000 });

    const cards = await page.$$("li[data-occludable-job-id]");
    const jobs = [];

    for (const card of cards) {
      const href = await card.getAttribute("data-occludable-job-id");
      const link = await card.$eval("a.job-card-list__title", (el: any) => el.href).catch(() => null);
      if (!link) continue;

      const idMatch = link.match(/\/jobs\/view\/(\d+)/) ?? [null, href];
      const externalId = idMatch[1] ?? href ?? "";

      const title = await card
        .$eval("a.job-card-list__title", (el: any) => el.textContent?.trim())
        .catch(() => "");
      const company = await card
        .$eval(".job-card-container__company-name", (el: any) => el.textContent?.trim())
        .catch(() => "");

      if (!externalId || !title) continue;

      jobs.push({ externalId, title, company, url: link });
    }

    return jobs;
  } finally {
    await context.close();
  }
};
```

Note: real LinkedIn selectors (`job-card-list__title`, `job-card-container__company-name`, `li[data-occludable-job-id]`) must be verified against the live logged-in search page — LinkedIn changes these periodically and this is the module most likely to need selector updates.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run scraper/sources/linkedin.test.ts`
Expected: PASS against the mocked Playwright API.

- [ ] **Step 7: Manual verification against the real site**

After Step 2's manual login, run:

```bash
npx tsx -e "import('./scraper/sources/linkedin').then(async ({scrapeLinkedin}) => console.log(await scrapeLinkedin('react')))"
```

Expected: array of real job postings logged, or a clear thrown error if selectors need updating (fix selectors in `scraper/sources/linkedin.ts` and retry).

- [ ] **Step 8: Commit**

```bash
git add scraper/sources/linkedin.ts scraper/sources/linkedin.test.ts scraper/login-linkedin.ts
git commit -m "feat: add LinkedIn Empleos scraper (Playwright, session-based)"
```

---

### Task 6: Wire all sources into the runner + entrypoint + cron docs

**Files:**
- Create: `scraper/index.ts`
- Modify: `package.json` (add `scrape` script)
- Create: `scraper/README.md`

**Interfaces:**
- Consumes: `runScrapers` (Task 1), `scrapeReddit` (Task 2), `scrapeComputrabajo` (Task 3), `scrapeZonajobs` (Task 4), `scrapeLinkedin` (Task 5).
- Produces: `npm run scrape` — runs one full pass across all 4 sources × active keywords.

- [ ] **Step 1: Write the entrypoint**

`scraper/index.ts`:

```ts
import { JobSource } from "@prisma/client";
import { runScrapers } from "./runner";
import { scrapeReddit } from "./sources/reddit";
import { scrapeComputrabajo } from "./sources/computrabajo";
import { scrapeZonajobs } from "./sources/zonajobs";
import { scrapeLinkedin } from "./sources/linkedin";

async function main() {
  await runScrapers({
    [JobSource.REDDIT]: scrapeReddit,
    [JobSource.COMPUTRABAJO]: scrapeComputrabajo,
    [JobSource.ZONAJOBS]: scrapeZonajobs,
    [JobSource.LINKEDIN]: scrapeLinkedin,
  });

  console.log("Scrape run complete.");
}

main()
  .catch((err) => {
    console.error("Fatal scraper error:", err);
    process.exit(1);
  });
```

- [ ] **Step 2: Add the npm script**

In `package.json` `scripts`:

```json
"scrape": "tsx scraper/index.ts"
```

- [ ] **Step 3: Manual verification**

```bash
npm run scrape
```

Expected: console shows any per-source errors (isolated, doesn't crash the run) and ends with "Scrape run complete." Then check the hub (`npm run dev`, visit `/`) — new jobs from at least Reddit should appear (Computrabajo/ZonaJobs/LinkedIn depend on selectors matching the live site per Tasks 3-5 caveats).

- [ ] **Step 4: Document the cron setup**

`scraper/README.md`:

```markdown
# Scraper

Run manually: `npm run scrape`

## Local cron (example, Linux/macOS crontab)

Runs every 6 hours:

    0 */6 * * * cd /path/to/trabajoteca && /usr/bin/npm run scrape >> scraper/scrape.log 2>&1

## Windows Task Scheduler

Create a Basic Task that runs:

    Program: npm.cmd
    Arguments: run scrape
    Start in: C:\path\to\trabajoteca

Trigger: repeat every 6 hours.

## LinkedIn session

`scraper/sources/linkedin.ts` needs a logged-in session in `scraper/.session/`.
Run `npx tsx scraper/login-linkedin.ts` once, log in manually in the browser
window it opens, then Ctrl+C. Re-run whenever LinkedIn invalidates the session
(login page shows up instead of job results).
```

- [ ] **Step 5: Commit**

```bash
git add scraper/index.ts scraper/README.md package.json
git commit -m "feat: wire scraper sources into runnable entrypoint, document cron setup"
```

---

## Definition of Done

- `npm run scrape` runs all 4 sources per active keyword, upserts into `Job`, isolates per-source failures (verified by Task 1's test).
- Reddit scraper verified against the live API (public, no auth).
- Computrabajo/ZonaJobs scrapers implemented against best-effort selectors — **implementer must verify against the live DOM during Tasks 3/4 and adjust selectors if the site markup differs**, this is expected and not a plan defect.
- LinkedIn scraper requires one-time manual login (`scraper/login-linkedin.ts`) before it can run; most likely source to need ongoing selector maintenance.
- Cron setup documented for both Linux/macOS and Windows in `scraper/README.md`.
