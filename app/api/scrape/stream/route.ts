import { NextRequest, NextResponse } from "next/server";
import { getSnapshot, subscribe } from "@/lib/scrapeJob";

export const dynamic = "force-dynamic";

// Read-only tail of the singleton scrape job (see lib/scrapeJob.ts) — this
// route no longer runs the scrape itself, so reconnecting (e.g. after a page
// reload) just replays what already happened and keeps tailing if the job is
// still running, instead of starting/stopping the scrape.
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const since = Number(request.nextUrl.searchParams.get("since") ?? "0");

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch {
          // client already disconnected
        }
      };

      const { running, logs } = getSnapshot();
      for (const entry of logs) {
        if (entry.seq > since) send(JSON.stringify(entry));
      }

      if (!running) {
        close();
        return;
      }

      const unsubscribe = subscribe((entry) => {
        send(JSON.stringify(entry));
        if (entry.type === "complete") {
          unsubscribe();
          close();
        }
      });

      request.signal.addEventListener("abort", () => {
        unsubscribe();
        closed = true;
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
