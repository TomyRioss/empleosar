"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { ExperienceEntry, EducationEntry } from "@/lib/profileTypes";

export type RegisterPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  province: string;
  city: string;
  street: string;
  phone: string;
  summary: string;
  languages: string[];
  skills: string[];
  certifications: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
};

export type RegisterResult = { error: string } | void;

export async function registerUser(payload: RegisterPayload): Promise<RegisterResult> {
  const email = payload.email?.trim().toLowerCase();
  const firstName = payload.firstName?.trim();
  const lastName = payload.lastName?.trim();
  const province = payload.province?.trim();
  const city = payload.city?.trim();

  if (!email || !payload.password || payload.password.length < 8) {
    return { error: "Email y password (mínimo 8 caracteres) requeridos" };
  }
  if (!firstName || !lastName || !province || !city) {
    return { error: "Nombre, apellido, provincia y municipio son requeridos" };
  }
  if (!payload.experience.some((e) => e.title.trim() && e.company.trim())) {
    return { error: "Agregá al menos una experiencia laboral con cargo y empresa" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Ese email ya está registrado" };
  }

  const passwordHash = await bcrypt.hash(payload.password, 10);
  try {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {
            firstName,
            lastName,
            province,
            city,
            street: payload.street?.trim() || null,
            phone: payload.phone?.trim() || null,
            summary: payload.summary?.trim() || null,
            languages: payload.languages,
            skills: payload.skills,
            certifications: payload.certifications,
            experience: payload.experience.filter((e) => e.title.trim() && e.company.trim()),
            education: payload.education.filter((e) => e.institution.trim() && e.degree.trim()),
          },
        },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Ese email ya está registrado" };
    }
    throw err;
  }

  redirect("/login?registered=1");
}
