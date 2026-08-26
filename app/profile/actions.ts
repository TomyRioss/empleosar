"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import type { ExperienceEntry, EducationEntry } from "@/lib/profileTypes";

async function requireUserId() {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  return session.user.id;
}

function parseListField(value: FormDataEntryValue | null): string[] {
  if (!value) return [];
  return String(value)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function updateProfile(formData: FormData) {
  const userId = await requireUserId();

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const province = (formData.get("province") as string)?.trim();
  const city = (formData.get("city") as string)?.trim();
  const street = (formData.get("street") as string)?.trim() || null;
  const showStreetInCv = formData.get("showStreetInCv") === "true";
  const phone = (formData.get("phone") as string)?.trim() || null;
  const summary = (formData.get("summary") as string)?.trim() || null;
  const languages = parseListField(formData.get("languages"));
  const skills = parseListField(formData.get("skills"));
  const certifications = parseListField(formData.get("certifications"));

  let experience: ExperienceEntry[] = [];
  let education: EducationEntry[] = [];
  try {
    experience = JSON.parse((formData.get("experienceJson") as string) || "[]");
    education = JSON.parse((formData.get("educationJson") as string) || "[]");
  } catch {
    throw new Error("Formato inválido de experiencia/educación");
  }

  if (!firstName || !lastName || !province || !city) {
    throw new Error("Nombre, apellido, provincia y ciudad son requeridos");
  }

  await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      firstName,
      lastName,
      province,
      city,
      street,
      showStreetInCv,
      phone,
      summary,
      languages,
      skills,
      certifications,
      experience,
      education,
    },
    update: {
      firstName,
      lastName,
      province,
      city,
      street,
      showStreetInCv,
      phone,
      summary,
      languages,
      skills,
      certifications,
      experience,
      education,
    },
  });

  revalidatePath("/profile");
}

export async function uploadCv(formData: FormData) {
  const userId = await requireUserId();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Archivo requerido");
  if (file.type !== "application/pdf") throw new Error("Solo se aceptan archivos PDF");
  if (file.size > 8 * 1024 * 1024) throw new Error("El archivo supera 8MB");

  const data = Buffer.from(await file.arrayBuffer());
  await prisma.cvFile.create({
    data: { userId, filename: file.name, mimeType: file.type, data },
  });

  revalidatePath("/profile");
}

export async function deleteCv(cvId: string) {
  const userId = await requireUserId();
  await prisma.cvFile.deleteMany({ where: { id: cvId, userId } });
  revalidatePath("/profile");
}
