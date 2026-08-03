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
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold mb-4">Algo salio mal</h1>
      <p className="text-gray-600 mb-4">No se pudo cargar la informacion. Intenta de nuevo.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="bg-black text-white rounded px-3 py-2 text-sm"
      >
        Reintentar
      </button>
    </main>
  );
}
