import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const cv = await prisma.generatedCv.findUnique({ where: { id } });
  if (!cv || cv.userId !== session.user.id) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(cv.data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${cv.filename}"`,
    },
  });
}
