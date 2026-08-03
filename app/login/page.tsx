import { loginWithCredentials } from "./actions";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; registered?: string }>;
}) {
  const { error, registered } = await searchParams;

  return (
    <main className="mx-auto max-w-sm w-full p-8 mt-16">
      <h1 className="font-display font-bold text-2xl text-text mb-1">
        Empleos<span className="text-accent">.AR</span>
      </h1>
      <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted mb-6">Ingresar</p>

      {registered && (
        <p className="text-sm text-status-applied mb-4">Cuenta creada, ya podés ingresar.</p>
      )}
      {error && <p className="text-sm text-status-discarded mb-4">{error}</p>}

      <form action={loginWithCredentials} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            required
            placeholder="tu@email.com"
            className="bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            required
            placeholder="••••••••"
            className="bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <button
          type="submit"
          className="bg-accent text-accent-ink font-medium rounded px-3 py-2 text-sm hover:brightness-110 transition mt-1"
        >
          Ingresar
        </button>
      </form>
      <p className="text-sm text-text-muted mt-4">
        No tenés cuenta?{" "}
        <Link href="/register" className="text-accent underline underline-offset-4">
          Registrate
        </Link>
      </p>
    </main>
  );
}
