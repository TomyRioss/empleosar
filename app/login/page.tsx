import { loginWithCredentials } from "./actions";
import { AuthCard } from "@/app/components/AuthCard";
import PasswordInput from "@/app/components/PasswordInput";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; registered?: string }>;
}) {
  const { error, registered } = await searchParams;

  const inputClass =
    "bg-bg border border-border rounded-md px-3 py-2.5 text-sm text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors";
  const labelClass = "font-mono text-[11px] uppercase tracking-widest text-text-muted";

  return (
    <AuthCard eyebrow="Bienvenido de nuevo" title="Ingresá a tu cuenta">
      {registered && (
        <p className="text-sm text-status-applied bg-status-applied/10 border border-status-applied/25 rounded-md px-3 py-2 mb-4">
          Cuenta creada, ya podés ingresar.
        </p>
      )}
      {error && (
        <p className="text-sm text-status-discarded bg-status-discarded/10 border border-status-discarded/25 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <form action={loginWithCredentials} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="tu@email.com"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className={labelClass}>
            Contraseña
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          className="bg-accent text-accent-ink font-medium rounded-md px-4 py-2.5 text-sm hover:brightness-110 transition mt-1"
        >
          Ingresar
        </button>
      </form>

      <p className="text-sm text-text-muted mt-6 text-center">
        No tenés cuenta?{" "}
        <Link href="/register" className="text-accent underline underline-offset-4">
          Registrate
        </Link>
      </p>
    </AuthCard>
  );
}
