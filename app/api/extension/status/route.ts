import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { JobStatusValue } from "@prisma/client";

const ALLOWED_STATUSES: ReadonlySet<string> = new Set(Object.values(JobStatusValue));

// Registra el estado de una postulación confirmada desde la extensión
// (empleosar-extension/content/web.js). La extensión corre en la pestaña de
// la web, así que hereda la sesión del navegador vía cookies.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const { jobId, status } = (body ?? {}) as { jobId?: unknown; status?: unknown };
  if (typeof jobId !== "string" || !jobId) {
    return new NextResponse("jobId is required", { status: 400 });
  }
  if (status !== undefined && (typeof status !== "string" || !ALLOWED_STATUSES.has(status))) {
    return new NextResponse("Invalid status", { status: 400 });
  }
  const next = (status as JobStatusValue) ?? JobStatusValue.APPLIED;

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!job) return new NextResponse("Job not found", { status: 404 });

  await prisma.jobStatus.upsert({
    where: { userId_jobId: { userId: session.user.id, jobId } },
    create: { userId: session.user.id, jobId, status: next },
    update: { status: next },
  });

  revalidatePath("/");
  return NextResponse.json({ ok: true, status: next });
}
