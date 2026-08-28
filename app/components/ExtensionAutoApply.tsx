"use client";

import { useEffect, useState } from "react";
import { FaBolt, FaChevronDown, FaDownload, FaPaperPlane, FaSpinner } from "react-icons/fa6";
import {
  TT_APPLIED,
  TT_PONG,
  TT_PORTAL_CLOSED,
  TT_POSTULATE,
  TT_POSTULATE_ERROR,
  TT_POSTULATE_SENT,
  TT_STATUS_APPLIED,
  type PostulatePayload,
} from "@/lib/extensionBridge";

type ExtState = "checking" | "yes" | "no";
type ApplyState = "idle" | "sent" | "applied" | "error";

export function ExtensionAutoApply({
  jobId,
  jobUrl,
  title,
  company,
  source,
  cvId,
}: {
  jobId: string;
  jobUrl: string;
  title?: string;
  company?: string;
  source?: string;
  cvId?: string | null;
}) {
  const [ext, setExt] = useState<ExtState>("checking");
  const [apply, setApply] = useState<ApplyState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    const timeout = setTimeout(() => {
      if (!done) setExt("no");
    }, 3500);
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === TT_PONG) {
        done = true;
        clearTimeout(timeout);
        setExt("yes");
      }
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === TT_POSTULATE_SENT && data.payload?.jobId === jobId) {
        setApply("sent");
      } else if (data.type === TT_POSTULATE_ERROR && data.payload?.jobId === jobId) {
        setError(data.payload.error ?? "Error al postular");
        setApply("error");
      } else if (data.type === TT_APPLIED && data.payload?.jobId === jobId) {
        window.dispatchEvent(new CustomEvent(TT_STATUS_APPLIED, { detail: { jobId } }));
        setApply("applied");
      } else if (data.type === TT_PORTAL_CLOSED && data.payload?.jobId === jobId) {
        setError("Cerraste el aviso antes de confirmar la postulación. Podés volver a intentar.");
        setApply("idle");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [jobId]);

  if (ext === "checking") return null;

  if (ext === "no") {
    return (
      <details className="group text-xs text-text-muted">
        <summary className="flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 [&::-webkit-details-marker]:hidden">
          <FaBolt size={11} className="shrink-0" />
          <span className="flex-1">Postular automáticamente desde acá</span>
          <FaChevronDown
            size={10}
            className="shrink-0 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <a
            href="/api/extension/download"
            className="inline-flex items-center gap-1.5 text-xs font-medium border rounded-full px-2.5 py-1 bg-accent/10 border-accent/25 text-accent hover:bg-accent/20 transition"
          >
            <FaDownload size={10} /> Descargar extensión (.zip)
          </a>
          <p>
            Con la extensión <strong className="text-text">EmpleosAR Auto-Apply</strong> el CV
            se adjunta solo en el portal y el aviso se marca como aplicado.
          </p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Descomprimí el .zip en una carpeta.</li>
            <li>
              En <code className="font-mono">chrome://extensions</code> activá{" "}
              <strong className="text-text">Modo de desarrollador</strong>.
            </li>
            <li>
              <strong className="text-text">Cargar descomprimida</strong> → seleccioná esa
              carpeta.
            </li>
          </ol>
          <p>La web sigue funcionando normal sin la extensión.</p>
        </div>
      </details>
    );
  }

  if (!cvId) return null;

  if (apply === "applied") {
    return (
      <span className="text-xs font-medium border rounded-full px-2.5 py-1 bg-status-applied/20 border-status-applied text-status-applied">
        Postulación enviada ✓
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={apply === "sent"}
        onClick={() => {
          setError(null);
          const payload: PostulatePayload = {
            jobId,
            jobUrl,
            cvUrl: `/api/cv/generated/${cvId}`,
            title,
            company,
            source,
          };
          window.postMessage({ type: TT_POSTULATE, payload }, window.location.origin);
          setApply("sent");
        }}
        className="inline-flex items-center justify-center gap-1.5 w-full text-xs font-medium border rounded-full px-3 py-2 bg-surface-alt border-border text-text-muted hover:text-text hover:border-text/40 transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {apply === "sent" ? (
          <>
            <FaSpinner className="animate-spin" size={11} />
            Aviso abierto en el portal — completá y confirmá allí
          </>
        ) : (
          <>
            <FaPaperPlane size={11} />
            Postular con extensión
          </>
        )}
      </button>
      {error && <p className="text-[11px] text-status-discarded">{error}</p>}
    </div>
  );
}