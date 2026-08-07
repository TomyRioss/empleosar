import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/scrapeJob";

export async function GET() {
  return NextResponse.json(getSnapshot());
}
