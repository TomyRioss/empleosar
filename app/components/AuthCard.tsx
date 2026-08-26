import type { ReactNode } from "react";

export function AuthCard({
  eyebrow,
  title,
  children,
  wide = false,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="flex items-start justify-center px-4 py-12 sm:py-16">
      <div className={`w-full ${wide ? "max-w-xl" : "max-w-sm"}`}>
        <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 shadow-sm">
          <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted mb-1">{eyebrow}</p>
          <h1 className="font-display font-bold text-2xl text-text mb-6">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}
