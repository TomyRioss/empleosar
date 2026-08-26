import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FaFileAlt } from "react-icons/fa";

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

export default async function GeneratedCvsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const generatedCvs = await prisma.generatedCv.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { job: { select: { title: true, company: true } } },
  });

  return (
    <main className="mx-auto max-w-3xl w-full px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-text">CVs generados</h1>
          <p className="text-sm text-text-muted mt-1">
            Un CV a medida por cada oferta para la que generaste uno.
          </p>
        </div>
        <Link href="/" className="text-sm text-text-muted hover:text-text underline underline-offset-4">
          Volver
        </Link>
      </div>

      {generatedCvs.length === 0 ? (
        <p className="text-text-muted">Todavía no generaste ningún CV.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {generatedCvs.map((cv) => (
            <li
              key={cv.id}
              className="flex items-center justify-between gap-4 bg-surface border border-border rounded-lg p-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FaFileAlt size={18} className="text-accent shrink-0" />
                <div className="min-w-0">
                  <p className="font-display font-medium text-text truncate">{cv.job.title}</p>
                  <p className="text-sm text-text-muted truncate">
                    {cv.job.company ?? "Empresa no especificada"} — generado el {formatDate(cv.createdAt)}
                  </p>
                </div>
              </div>
              <a
                href={`/api/cv/generated/${cv.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium border rounded-full px-2.5 py-1 bg-status-applied/20 border-status-applied text-status-applied shrink-0"
              >
                Descargar
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
