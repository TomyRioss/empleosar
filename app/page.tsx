import { getJobs } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/auth";
import { StatusButtons } from "@/app/jobs/StatusButtons";
import { RunScrapeButton } from "@/app/jobs/RunScrapeButton";
import { JobSource } from "@prisma/client";
import Link from "next/link";

const SOURCE_COLOR: Record<JobSource, string> = {
  LINKEDIN: "border-l-source-linkedin",
  COMPUTRABAJO: "border-l-source-computrabajo",
  ZONAJOBS: "border-l-source-zonajobs",
  REDDIT: "border-l-source-reddit",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    keyword?: string;
    search?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const source =
    params.source && Object.values(JobSource).includes(params.source as JobSource)
      ? (params.source as JobSource)
      : undefined;
  const jobs = await getJobs({
    source,
    keyword: params.keyword || undefined,
    search: params.search || undefined,
    sort: params.sort === "oldest" ? "oldest" : "recent",
    userId: session?.user?.id,
  });
  const keywords = await prisma.keyword.findMany({ where: { active: true } });

  return (
    <>
      <header className="border-b border-border bg-surface-alt">
        <div className="mx-auto max-w-5xl px-6 py-5 flex justify-between items-center gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-text">
              Empleos<span className="text-accent">.AR</span>
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted mt-1">
              Bolsin de avisos — mercado argentino
            </p>
          </div>
          <div className="flex items-center gap-3">
            {process.env.NODE_ENV === "development" && <RunScrapeButton />}
            {session?.user ? (
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button type="submit" className="text-sm text-text-muted hover:text-text underline underline-offset-4">
                  Salir ({session.user.email})
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
          <div className="flex flex-col gap-1">
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
              <option value="LINKEDIN">LinkedIn</option>
              <option value="COMPUTRABAJO">Computrabajo</option>
              <option value="ZONAJOBS">ZonaJobs</option>
              <option value="REDDIT">Reddit</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="keyword" className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
              Rubro
            </label>
            <select
              id="keyword"
              name="keyword"
              defaultValue={params.keyword}
              className="bg-bg border border-border rounded px-2 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Todos</option>
              {keywords.map((k) => (
                <option key={k.id} value={k.term}>
                  {k.term}
                </option>
              ))}
            </select>
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

          <button
            type="submit"
            className="bg-accent text-accent-ink font-medium rounded px-3 py-2 text-sm hover:brightness-110 transition"
          >
            Filtrar
          </button>
        </form>

        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <li
              key={job.id}
              className={`bg-surface border border-border border-l-4 ${SOURCE_COLOR[job.source]} rounded-lg p-4`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <h2 className="font-display font-medium text-lg text-text truncate">{job.title}</h2>
                  <p className="text-sm text-text-muted mt-0.5">
                    {job.company} — {job.location}
                  </p>
                  <p className="mt-2 flex items-center gap-2">
                    <span className="stamp text-[10px] uppercase tracking-wider border border-border rounded px-1.5 py-0.5 text-text-muted">
                      {job.source}
                    </span>
                    <span className="font-mono text-[11px] text-text-muted">{job.keywordMatched}</span>
                  </p>
                </div>
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent underline underline-offset-4 shrink-0 hover:brightness-110"
                >
                  Ver original
                </a>
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
          <p className="text-text-muted col-span-full md:col-start-2">No hay avisos todavía.</p>
        )}
      </main>
    </>
  );
}
