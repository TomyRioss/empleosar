"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { JobStatusValue } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function setJobStatus(jobId: string, status: JobStatusValue) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  await prisma.jobStatus.upsert({
    where: { userId_jobId: { userId: session.user.id, jobId } },
    create: { userId: session.user.id, jobId, status },
    update: { status },
  });

  revalidatePath("/");
}
