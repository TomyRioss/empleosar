# Scraper

Run manually: `npm run scrape` — or from the dev server, click "Buscar ahora" in the header (only visible when `next dev` is running).

Sources (verified against the real sites, real run logged in commit history):
- **Computrabajo** — plain HTML fetch + parse. Works: a real run pulled 20 live listings per keyword.
- **Reddit** — public JSON API, no auth needed in principle, but `reddit.com/.../search.json` and `old.reddit.com` both returned a network-level 403 ("Blocked") from this environment's outbound IP — not a code bug, Reddit is blocking the IP range itself. May work fine from a different network; nothing to fix in the scraper.
- **ZonaJobs** — blocked by Cloudflare's bot challenge, confirmed with a real headless-Chromium request (gets the "Attention Required" interstitial, not results). The source throws a clear error, isolated by the runner. Needs a stealth/proxy setup to unblock (not attempted here).
- **LinkedIn** — needs a logged-in session. Run once: `npx tsx scraper/login-linkedin.ts`, log in manually in the window it opens, then Ctrl+C. Session persists in `scraper/.session/` (gitignored). Re-run whenever LinkedIn invalidates it.

## Local cron (Linux/macOS)

    0 */6 * * * cd /path/to/trabajoteca && /usr/bin/npm run scrape >> scraper/scrape.log 2>&1

## Windows Task Scheduler

    Program: npm.cmd
    Arguments: run scrape
    Start in: C:\path\to\trabajoteca

Trigger: repeat every 6 hours.
