import { NextResponse } from "next/server";
import { startScrapeJob } from "@/lib/scrapeJob";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Scraping is only available in development" }, { status: 403 });
  }

  const started = startScrapeJob();
  return NextResponse.json({ started });
}
