"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { generateCvAction } from "./actions";

export function GenerateCvButton({
  jobId,
  isLoggedIn,
  initialCvId = null,
}: {
  jobId: string;
  isLoggedIn: boolean;
  initialCvId?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [cvId, setCvId] = useState<string | null>(initialCvId);
  const [isPending, startTransition] = useTransition();

  if (!isLoggedIn) {
    return (
      <Link
        href="/login"
        className="text-xs font-medium border rounded-full px-2.5 py-1 bg-accent/10 border-accent/25 text-accent hover:bg-accent/20 transition"
      >
        Generar CV para esta oferta
      </Link>
    );
  }

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await generateCvAction(jobId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setCvId(result.id);
      }
    });
  }

  if (cvId) {
    return (
      <a
        href={`/api/cv/generated/${cvId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium border rounded-full px-2.5 py-1 bg-status-applied/20 border-status-applied text-status-applied"
      >
        Descargar CV generado
      </a>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs font-medium border rounded-full px-2.5 py-1 bg-accent/10 border-accent/25 text-accent hover:bg-accent/20 transition disabled:opacity-50"
      >
        {isPending ? "Generando..." : "Generar CV para esta oferta"}
      </button>
      {error && (
        <p className="text-[11px] text-status-discarded max-w-[220px] text-right">
          {error}{" "}
          {error.includes("perfil") && (
            <Link href="/profile" className="underline underline-offset-2">
              Completar perfil
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
