import { getJobs } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import type { JobSource } from "@prisma/client";

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
  const jobs = await getJobs({
    source: params.source as JobSource | undefined,
    keyword: params.keyword || undefined,
    search: params.search || undefined,
    sort: params.sort === "oldest" ? "oldest" : "recent",
  });
  const keywords = await prisma.keyword.findMany({ where: { active: true } });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold mb-6">Empleos Argentina</h1>

      <form className="flex flex-wrap gap-2 mb-6" method="get">
        <input
          type="text"
          name="search"
          defaultValue={params.search}
          placeholder="Buscar..."
          className="border rounded px-3 py-1 text-sm"
        />
        <select name="source" defaultValue={params.source} className="border rounded px-2 py-1 text-sm">
          <option value="">Todas las fuentes</option>
          <option value="LINKEDIN">LinkedIn</option>
          <option value="COMPUTRABAJO">Computrabajo</option>
          <option value="ZONAJOBS">ZonaJobs</option>
          <option value="REDDIT">Reddit</option>
        </select>
        <select name="keyword" defaultValue={params.keyword} className="border rounded px-2 py-1 text-sm">
          <option value="">Todas las keywords</option>
          {keywords.map((k) => (
            <option key={k.id} value={k.term}>
              {k.term}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={params.sort} className="border rounded px-2 py-1 text-sm">
          <option value="recent">Mas recientes</option>
          <option value="oldest">Mas antiguos</option>
        </select>
        <button type="submit" className="bg-black text-white rounded px-3 py-1 text-sm">
          Filtrar
        </button>
      </form>

      <ul className="flex flex-col gap-4">
        {jobs.map((job) => (
          <li key={job.id} className="border rounded p-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-medium">{job.title}</h2>
                <p className="text-sm text-gray-600">
                  {job.company} — {job.location}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {job.source} · {job.keywordMatched}
                </p>
              </div>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline shrink-0"
              >
                Ver original
              </a>
            </div>
          </li>
        ))}
      </ul>
      {jobs.length === 0 && <p className="text-gray-500">No hay avisos todavia.</p>}
    </main>
  );
}
