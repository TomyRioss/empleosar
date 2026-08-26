import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StatusButtons } from "@/app/jobs/StatusButtons";
import { GenerateCvButton } from "@/app/cv/GenerateCvButton";
import { getKeywordCategory, getKeywordCategoryIcon } from "@/app/components/keywordCategories";
import { SOURCE_COLOR, SOURCE_LOGO, timeAgo } from "@/lib/jobDisplay";
import { summarizeJobDescription } from "@/lib/summarizeJob";

const SOURCE_LABEL: Record<string, string> = {
  LINKEDIN: "LinkedIn",
  COMPUTRABAJO: "Computrabajo",
  ZONAJOBS: "ZonaJobs",
  REDDIT: "Reddit",
};

function KeywordBadge({ term }: { term: string }) {
  return (() => {
    const Icon = getKeywordCategoryIcon(term);
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-accent bg-accent/10 rounded-full px-2.5 py-1 mb-3">
        {Icon && <Icon size={11} />}
        {getKeywordCategory(term) || term}
      </span>
    );
  })();
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      keywords: { include: { keyword: true } },
      statuses: { where: { userId: session?.user?.id ?? "" } },
      generatedCvs: session?.user
        ? { where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true } }
        : false,
    },
  });

  if (!job) notFound();

  const primaryKeyword = job.keywords[0]?.keyword.term;
  const hasDescription = !!job.description;
  let aiSummary = job.aiSummary;

  if (hasDescription && !aiSummary) {
    try {
      aiSummary = await summarizeJobDescription(job.description!);
      await prisma.job.update({ where: { id: job.id }, data: { aiSummary } });
    } catch {
      // Best-effort: no summary yet is fine, the full description still renders below.
    }
  }

  return (
    <main className="mx-auto max-w-7xl w-full px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
      >
        ← Volver a avisos
      </Link>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        <div className="min-w-0 flex flex-col gap-6">
          <div className="bg-surface border border-border rounded-xl p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {primaryKeyword && <KeywordBadge term={primaryKeyword} />}
                <h1 className="font-display font-bold text-3xl sm:text-4xl text-text text-balance leading-tight">
                  {job.title}
                </h1>
                <p className="text-text-muted text-lg mt-2">
                  {job.company ?? "Empresa no especificada"}
                  {job.location && <span> — {job.location}</span>}
                </p>
              </div>
              <div
                className={`hidden sm:flex shrink-0 w-16 h-16 bg-surface-alt border-2 ${SOURCE_COLOR[job.source]} rounded-2xl p-3 items-center justify-center overflow-hidden shadow-sm`}
              >
                <img
                  src={SOURCE_LOGO[job.source]}
                  alt={job.source}
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-border">
              {job.keywords.map(({ keyword }) => (
                <span
                  key={keyword.id}
                  className="font-mono text-[11px] text-text-muted bg-surface-alt rounded-full px-2.5 py-1"
                >
                  {keyword.term}
                </span>
              ))}
              {job.keywords.length === 0 && (
                <span className="text-sm text-text-muted">Sin rubro asignado</span>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden border border-border">
            {[
              { label: "Fuente", value: SOURCE_LABEL[job.source] ?? job.source },
              { label: "Publicado", value: timeAgo(job.postedAt) },
              { label: "Detectado", value: timeAgo(job.scrapedAt) },
              { label: "Ubicación", value: job.location ?? "—" },
            ].map((item) => (
              <div key={item.label} className="bg-surface px-4 py-3">
                <dt className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{item.label}</dt>
                <dd className="text-sm text-text mt-1 truncate">{item.value}</dd>
              </div>
            ))}
          </dl>

          {aiSummary && (
            <div className="bg-accent/5 border border-accent/25 rounded-xl p-6 sm:p-8">
              <p className="font-mono text-[10px] uppercase tracking-widest text-accent mb-2">Resumen IA</p>
              <p className="text-text leading-relaxed">{aiSummary}</p>
            </div>
          )}

          <div className="bg-surface border border-border rounded-xl p-6 sm:p-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted mb-3">Descripción completa</p>
            {hasDescription ? (
              <p className="text-text leading-relaxed whitespace-pre-line">{job.description}</p>
            ) : (
              <p className="text-text-muted text-sm">
                Todavía no tenemos la descripción completa de este aviso.{" "}
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline underline-offset-4"
                >
                  Verla en el sitio original
                </a>
                .
              </p>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-8">
          <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-accent text-accent-ink font-medium rounded-lg px-4 py-2.5 text-sm hover:brightness-110 transition"
            >
              Ver aviso original
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </a>

            <div className="pt-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted mb-2">Tu estado</p>
              <StatusButtons
                jobId={job.id}
                isLoggedIn={!!session?.user}
                initialStatus={job.statuses[0]?.status ?? null}
              />
            </div>

            <div className="pt-4 border-t border-border">
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted mb-2">CV a medida</p>
              <GenerateCvButton
                jobId={job.id}
                isLoggedIn={!!session?.user}
                initialCvId={job.generatedCvs && job.generatedCvs[0] ? job.generatedCvs[0].id : null}
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
