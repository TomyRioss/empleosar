"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FaWandMagicSparkles, FaDownload, FaSpinner } from "react-icons/fa6";
import { generateCvAction } from "./actions";

const PILL =
  "inline-flex items-center justify-center gap-1.5 w-full text-xs font-medium rounded-full px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed";

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
        className={`${PILL} bg-accent/10 border border-accent/25 text-accent hover:bg-accent/20`}
      >
        <FaWandMagicSparkles size={12} />
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
        className={`${PILL} bg-status-applied/20 border border-status-applied text-status-applied hover:bg-status-applied/30`}
      >
        <FaDownload size={12} />
        Descargar CV generado
      </a>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`${PILL} bg-accent/10 border border-accent/25 text-accent hover:bg-accent/20`}
      >
        {isPending ? (
          <>
            <FaSpinner className="animate-spin" size={11} />
            Generando CV…
          </>
        ) : (
          <>
            <FaWandMagicSparkles size={12} />
            Generar CV para esta oferta
          </>
        )}
      </button>
      {error && (
        <p className="text-[11px] text-status-discarded">
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
