import { getJobs } from "@/lib/jobs";

export default async function Home() {
  const jobs = await getJobs();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold mb-6">Empleos Argentina</h1>
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
      {jobs.length === 0 && (
        <p className="text-gray-500">No hay avisos todavia.</p>
      )}
    </main>
  );
}
