# Scraper

Run manually: `npm run scrape` — or from the dev server, click "Buscar ahora" in the header (only visible when `next dev` is running).

Sources (verified against the real sites, real run logged in commit history):
- **Computrabajo** — plain HTML fetch + parse. Works: 20 live listings per keyword.
- **Reddit** — the public `.json` API and a plain headless browser are both blocked (network-level 403 / stuck in Reddit's own JS proof-of-work challenge). A stealth-patched browser (`playwright-extra` + `puppeteer-extra-plugin-stealth`) gets past it and parses the real search page. Works, but r/empleos is a tiny, low-traffic subreddit — expect 0 results for narrow keywords, that's real, not a bug.
- **ZonaJobs** — same story as Reddit: plain headless Chromium gets Cloudflare's "Attention Required" interstitial, stealth gets through to the real listing. Sorted by `?recientes=true` (most recent first). Works: ~20 live listings per keyword.
- **LinkedIn** — needs a logged-in session. Run once: `npx tsx scraper/login-linkedin.ts`, log in manually in the window it opens, then Ctrl+C. Session persists in `scraper/.session/` (gitignored). Re-run whenever LinkedIn invalidates it. Also stealth-patched, but untested end-to-end here since no session was set up.

All 4 modules launch their own Chromium instance (except Computrabajo, plain `fetch`) — expect a scrape run to take longer and use more memory than a pure-HTTP scraper.

## Local cron (Linux/macOS)

    0 */6 * * * cd /path/to/trabajoteca && /usr/bin/npm run scrape >> scraper/scrape.log 2>&1

## Windows Task Scheduler

    Program: npm.cmd
    Arguments: run scrape
    Start in: C:\path\to\trabajoteca

Trigger: repeat every 6 hours.
