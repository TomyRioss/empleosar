import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ProfileEditor } from "./ProfileEditor";
import { CvUploader } from "./CvUploader";
import type { ExperienceEntry, EducationEntry, ProfileData } from "@/lib/profileTypes";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [profile, cvFiles] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: session.user.id } }),
    prisma.cvFile.findMany({
      where: { userId: session.user.id },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, filename: true, uploadedAt: true },
    }),
  ]);

  const initial: ProfileData = {
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    phone: profile?.phone ?? "",
    province: profile?.province ?? "",
    city: profile?.city ?? "",
    street: profile?.street ?? "",
    showStreetInCv: profile?.showStreetInCv ?? true,
    summary: profile?.summary ?? "",
    languages: (profile?.languages as string[] | undefined) ?? [],
    skills: (profile?.skills as string[] | undefined) ?? [],
    certifications: (profile?.certifications as string[] | undefined) ?? [],
    experience: (profile?.experience as ExperienceEntry[] | undefined) ?? [],
    education: (profile?.education as EducationEntry[] | undefined) ?? [],
  };

  return (
    <main className="mx-auto max-w-6xl w-full px-6 py-8">
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-border">
        <div>
          <h1 className="font-display font-bold text-2xl text-text">Mi perfil</h1>
          <p className="text-sm text-text-muted mt-1">
            Esta información se usa para generar CVs a medida para cada oferta.
          </p>
        </div>
        <Link href="/" className="text-sm text-text-muted hover:text-text underline underline-offset-4">
          Volver
        </Link>
      </div>

      <ProfileEditor initial={initial} />

      <div className="mt-10 border-t border-border pt-8">
        <CvUploader
          files={cvFiles.map((f) => ({ id: f.id, filename: f.filename, uploadedAt: f.uploadedAt.toISOString() }))}
        />
      </div>
    </main>
  );
}
