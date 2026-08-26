import { prisma } from "@/lib/prisma";
import { deepseekJson } from "@/lib/deepseek";
import { renderHarvardCv, type CvContent } from "@/lib/cvTemplate";
import { isProfileComplete, type ExperienceEntry, type EducationEntry } from "@/lib/profileTypes";

type AiCvResponse = {
  summary: string;
  experience: { title: string; company: string; dateRange: string; description: string }[];
  education: { institution: string; degree: string; dateRange: string; description: string }[];
  certifications: string[];
  skills: string[];
};

const SYSTEM_PROMPT = `Sos un redactor experto en CVs estilo Harvard (ATS, minimalista).
Recibís el perfil REAL de una persona y una oferta laboral. Tu tarea:
- Seleccionar y reescribir el resumen, experiencia, educación, certificaciones y habilidades
  para destacar lo más relevante para ESA oferta específica.
- NUNCA inventes empleadores, cargos, fechas, títulos o certificaciones que no estén en el perfil.
  Podés reordenar, resumir y elegir qué incluir, pero todo dato debe venir del perfil dado.
- Escribí en español, tono profesional y directo, oraciones concisas orientadas a logros.
- Devolvé SOLO un JSON válido con esta forma exacta:
{
  "summary": string,
  "experience": [{"title": string, "company": string, "dateRange": string, "description": string}],
  "education": [{"institution": string, "degree": string, "dateRange": string, "description": string}],
  "certifications": [string],
  "skills": [string]
}`;

export async function generateCvForJob(userId: string, jobId: string) {
  const [profile, job] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.job.findUnique({ where: { id: jobId } }),
  ]);

  if (!job) throw new Error("Oferta no encontrada");
  if (
    !isProfileComplete({
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      province: profile?.province ?? "",
      city: profile?.city ?? "",
      experience: profile?.experience,
    })
  ) {
    throw new Error("Completá tu perfil (nombre, ubicación y al menos una experiencia) antes de generar un CV");
  }

  const experience = (profile!.experience as ExperienceEntry[]) ?? [];
  const education = (profile!.education as EducationEntry[]) ?? [];
  const languages = (profile!.languages as string[]) ?? [];
  const skills = (profile!.skills as string[]) ?? [];
  const certifications = (profile!.certifications as string[]) ?? [];

  const userPrompt = `PERFIL REAL:
Nombre: ${profile!.firstName} ${profile!.lastName}
Resumen actual: ${profile!.summary ?? "(sin resumen previo)"}
Experiencia: ${JSON.stringify(experience)}
Educación: ${JSON.stringify(education)}
Certificaciones: ${JSON.stringify(certifications)}
Habilidades: ${JSON.stringify(skills)}
Idiomas: ${JSON.stringify(languages)}

OFERTA LABORAL:
Título: ${job.title}
Empresa: ${job.company ?? "No especificada"}
Ubicación: ${job.location ?? "No especificada"}`;

  const ai = await deepseekJson<AiCvResponse>(SYSTEM_PROMPT, userPrompt);

  const contactParts = [
    profile!.phone,
    [profile!.showStreetInCv ? profile!.street : null, profile!.city, profile!.province]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  const content: CvContent = {
    fullName: `${profile!.firstName} ${profile!.lastName}`.toUpperCase(),
    contactLine: contactParts.join(" — "),
    summary: ai.summary,
    experience: ai.experience.map((e) => ({
      title: e.title,
      company: e.company,
      dateRange: e.dateRange,
      startDate: "",
      endDate: "",
      description: e.description,
    })),
    education: ai.education.map((e) => ({
      institution: e.institution,
      degree: e.degree,
      dateRange: e.dateRange,
      startDate: "",
      endDate: "",
      description: e.description,
    })),
    certifications: ai.certifications,
    skills: ai.skills,
    languages,
  };

  const pdfBuffer = await renderHarvardCv(content);
  const filename = `CV - ${job.title} - ${job.company ?? ""}.pdf`.slice(0, 150);

  const record = await prisma.generatedCv.create({
    data: { userId, jobId, filename, data: new Uint8Array(pdfBuffer) },
  });

  return record;
}
