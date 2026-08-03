"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-sm w-full p-8 mt-16">
      <h1 className="font-display font-bold text-2xl text-text mb-1">Algo salió mal</h1>
      <p className="text-sm text-text-muted mb-4">No se pudo cargar la información. Intentá de nuevo.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="bg-accent text-accent-ink font-medium rounded px-3 py-2 text-sm hover:brightness-110 transition"
      >
        Reintentar
      </button>
    </main>
  );
}
