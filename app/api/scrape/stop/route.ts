import { NextResponse } from "next/server";
import { stopScrapeJob } from "@/lib/scrapeJob";

export async function POST() {
  const stopped = stopScrapeJob();
  return NextResponse.json({ stopped });
}
