import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { UserMenu } from "@/app/components/UserMenu";

export async function Header() {
  const session = await auth();
  const profile = session?.user
    ? await prisma.profile.findUnique({
        where: { userId: session.user.id },
        select: { firstName: true, lastName: true },
      })
    : null;

  return (
    <header className="border-b border-border bg-surface-alt">
      <div className="mx-auto max-w-7xl px-6 py-4 flex justify-between items-center gap-4">
        <Link href="/" className="shrink-0">
          <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-text">
            Empleos<span className="text-accent">.AR</span>
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted mt-0.5">
            Bolsin de avisos — mercado argentino
          </p>
        </Link>

        <form method="get" action="/" className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <input
              type="text"
              name="search"
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
        </form>

        <div className="flex items-center gap-3 shrink-0">
          {session?.user ? (
            <>
              {profile && <UserMenu name={`${profile.firstName} ${profile.lastName}`} />}
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
            </>
          ) : (
            <>
              <Link
                href="/register"
                className="font-mono text-[11px] uppercase tracking-widest border border-accent text-accent rounded px-2.5 py-1.5 hover:bg-accent hover:text-accent-ink transition"
              >
                Buscar ahora
              </Link>
              <Link href="/login" className="text-sm text-text-muted hover:text-text underline underline-offset-4">
                Entrar
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
