import { getJobs, getJobCount, getLastScrapedAt } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/auth";
import { StatusButtons } from "@/app/jobs/StatusButtons";
import { RunScrapeButton } from "@/app/jobs/RunScrapeButton";
import { KeywordSelect } from "@/app/components/KeywordSelect";
import { getKeywordCategory, getKeywordCategoryIcon } from "@/app/components/keywordCategories";
import { JobSource } from "@prisma/client";
import Link from "next/link";
import { SortSelect } from "@/app/components/SortSelect";

const SOURCE_COLOR: Record<JobSource, string> = {
  LINKEDIN: "border-source-linkedin/40",
  COMPUTRABAJO: "border-source-computrabajo/40",
  ZONAJOBS: "border-source-zonajobs/40",
  REDDIT: "border-source-reddit/40",
};

const SOURCE_LOGO: Record<JobSource, string> = {
  LINKEDIN: "/logos/linkedin.png",
  COMPUTRABAJO: "/logos/computrabajo.png",
  ZONAJOBS: "/logos/zonajobs.png",
  REDDIT: "/logos/reddit.png",
};

function timeAgo(date: Date | null): string {
  if (!date) return "nunca";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "hace unos segundos";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min${minutes > 1 ? "s" : ""}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} hr${hours > 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} día${days > 1 ? "s" : ""}`;
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function pageHref(
  params: { source?: string; keyword?: string; search?: string; sort?: string },
  page: number,
): string {
  const qs = new URLSearchParams();
  if (params.source) qs.set("source", params.source);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.search) qs.set("search", params.search);
  if (params.sort) qs.set("sort", params.sort);
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return s ? `/?${s}` : "/";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    keyword?: string;
    search?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const source =
    params.source && Object.values(JobSource).includes(params.source as JobSource)
      ? (params.source as JobSource)
      : undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 25;
  const jobs = await getJobs({
    source,
    keyword: params.keyword || undefined,
    search: params.search || undefined,
    sort: params.sort === "oldest" ? "oldest" : "recent",
    userId: session?.user?.id,
    page,
    pageSize,
  });
  const jobCount = await getJobCount({
    source,
    keyword: params.keyword || undefined,
    search: params.search || undefined,
  });
  const totalPages = Math.max(1, Math.ceil(jobCount / pageSize));
  const lastScrapedAt = await getLastScrapedAt();
  const keywords = await prisma.keyword.findMany({ where: { active: true } });

  return (
    <>
      <header className="border-b border-border bg-surface-alt">
        <div className="mx-auto max-w-5xl px-6 py-4 flex justify-between items-center gap-4">
          <Link href="/" className="shrink-0">
            <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-text">
              Empleos<span className="text-accent">.AR</span>
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted mt-0.5">
              Bolsin de avisos — mercado argentino
            </p>
          </Link>

          <form
            method="get"
            className="hidden md:flex items-center flex-1 max-w-md mx-4"
          >
            <div className="relative w-full">
              <input
                type="text"
                name="search"
                defaultValue={params.search}
                placeholder="Buscar puesto, empresa..."
                className="w-full bg-bg border border-border rounded-full pl-4 pr-10 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-1.5"
                aria-label="Buscar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </button>
            </div>
            {params.source && <input type="hidden" name="source" value={params.source} />}
            {params.keyword && <input type="hidden" name="keyword" value={params.keyword} />}
            {params.sort && <input type="hidden" name="sort" value={params.sort} />}
          </form>

          <div className="flex items-center gap-3 shrink-0">
            {process.env.NODE_ENV === "development" && <RunScrapeButton />}
            {session?.user ? (
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button type="submit" className="text-sm text-text-muted hover:text-text underline underline-offset-4">
                  Salir
                </button>
              </form>
            ) : (
              <Link href="/login" className="text-sm text-text-muted hover:text-text underline underline-offset-4">
                Ingresar
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl w-full px-6 py-8 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
        <form
          method="get"
          className="flex flex-col gap-4 bg-surface border border-border rounded-lg p-4 h-fit md:sticky md:top-8"
        >
          <div className="md:hidden flex flex-col gap-1">
            <label htmlFor="search" className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
              Buscar
            </label>
            <input
              id="search"
              type="text"
              name="search"
              defaultValue={params.search}
              placeholder="puesto, empresa..."
              className="bg-bg border border-border rounded px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="source" className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
              Fuente
            </label>
            <select
              id="source"
              name="source"
              defaultValue={params.source}
              className="bg-bg border border-border rounded px-2 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Todas</option>
              <option value="COMPUTRABAJO">Computrabajo</option>
              <option value="ZONAJOBS">ZonaJobs</option>
              <option value="REDDIT">Reddit</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="keyword" className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
              Rubro
            </label>
            <KeywordSelect keywords={keywords} defaultValue={params.keyword} />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="sort" className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
              Orden
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={params.sort}
              className="bg-bg border border-border rounded px-2 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="recent">Más recientes</option>
              <option value="oldest">Más antiguos</option>
            </select>
          </div>

          {params.search && <input type="hidden" name="search" value={params.search} />}

          <button
            type="submit"
            className="bg-accent text-accent-ink font-medium rounded px-3 py-2 text-sm hover:brightness-110 transition"
          >
            Filtrar
          </button>
        </form>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 bg-surface border border-border rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="font-display font-semibold text-text">
                {jobCount} {jobCount === 1 ? "aviso" : "avisos"}
              </span>
              <span className="text-text-muted text-sm">
                Último análisis: {timeAgo(lastScrapedAt)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                <path d="m3 16 4 4 4-4" />
                <path d="M7 20V4" />
                <path d="m21 8-4-4-4 4" />
                <path d="M17 4v16" />
              </svg>
              <SortSelect currentSort={params.sort} />
            </div>
          </div>

          <ul className="flex flex-col gap-3">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="bg-surface border border-border rounded-lg p-4 transition hover:border-text-muted/40"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    {job.keywords[0] && (() => {
                      const CategoryIcon = getKeywordCategoryIcon(job.keywords[0].keyword.term);
                      return (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-accent bg-accent/10 rounded-full px-2 py-0.5 mb-1.5">
                          {CategoryIcon && <CategoryIcon size={10} />}
                          {getKeywordCategory(job.keywords[0].keyword.term) || job.keywords[0].keyword.term}
                        </span>
                      );
                    })()}
                    <h2 className="font-display font-medium text-lg text-text truncate">{job.title}</h2>
                    <p className="text-sm text-text-muted mt-0.5">
                      {job.company} — {job.location}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-2">
                      {job.keywords.map(({ keyword }) => (
                        <span
                          key={keyword.id}
                          className="font-mono text-[11px] text-text-muted bg-surface-alt rounded-full px-2 py-0.5"
                        >
                          {keyword.term}
                        </span>
                      ))}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="font-mono text-[11px] text-text-muted">
                      {timeAgo(job.postedAt || job.scrapedAt)}
                    </span>
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-accent underline underline-offset-4 hover:brightness-110"
                    >
                      Ver original
                    </a>
                    <div className={`w-14 h-14 bg-surface-alt border-2 ${SOURCE_COLOR[job.source]} rounded-2xl p-2.5 flex items-center justify-center overflow-hidden shadow-sm`}>
                      <img
                        src={SOURCE_LOGO[job.source]}
                        alt={job.source}
                        className="w-full h-full object-contain rounded-xl"
                      />
                    </div>
                  </div>
                </div>
                <StatusButtons
                  jobId={job.id}
                  isLoggedIn={!!session?.user}
                  initialStatus={job.statuses[0]?.status ?? null}
                />
              </li>
            ))}
          </ul>
          {jobs.length === 0 && (
            <p className="text-text-muted">No hay avisos todavía.</p>
          )}

          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-2 mt-2" aria-label="Paginación">
              <Link
                href={pageHref(params, page - 1)}
                aria-disabled={page <= 1}
                className={`text-sm border border-border rounded px-3 py-1.5 ${
                  page <= 1
                    ? "pointer-events-none text-text-muted/40"
                    : "text-text hover:border-text-muted"
                }`}
              >
                Anterior
              </Link>
              <span className="font-mono text-xs text-text-muted px-2">
                Página {page} de {totalPages}
              </span>
              <Link
                href={pageHref(params, page + 1)}
                aria-disabled={page >= totalPages}
                className={`text-sm border border-border rounded px-3 py-1.5 ${
                  page >= totalPages
                    ? "pointer-events-none text-text-muted/40"
                    : "text-text hover:border-text-muted"
                }`}
              >
                Siguiente
              </Link>
            </nav>
          )}
        </div>
      </main>
    </>
  );
}
