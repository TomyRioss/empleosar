import { JobSource } from "@prisma/client";
import { runScrapers } from "./runner";
import { scrapeReddit } from "./sources/reddit";
import { scrapeComputrabajo } from "./sources/computrabajo";
import { scrapeZonajobs } from "./sources/zonajobs";
import { scrapeLinkedin } from "./sources/linkedin";

async function main() {
  const results = await runScrapers({
    [JobSource.REDDIT]: scrapeReddit,
    [JobSource.COMPUTRABAJO]: scrapeComputrabajo,
    [JobSource.ZONAJOBS]: scrapeZonajobs,
    [JobSource.LINKEDIN]: scrapeLinkedin,
  });

  console.table(results);
  console.log("Scrape run complete.");
}

main().catch((err) => {
  console.error("Fatal scraper error:", err);
  process.exit(1);
});
