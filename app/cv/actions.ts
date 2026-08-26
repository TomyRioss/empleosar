"use server";

import { auth } from "@/auth";
import { generateCvForJob } from "@/lib/generateCv";

export async function generateCvAction(jobId: string): Promise<{ id: string } | { error: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Necesitás iniciar sesión" };

  try {
    const cv = await generateCvForJob(session.user.id, jobId);
    return { id: cv.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error al generar el CV" };
  }
}
