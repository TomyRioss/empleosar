"use client";

import { useRef, useState, useTransition } from "react";
import { uploadCv, deleteCv } from "./actions";

export type CvFileMeta = { id: string; filename: string; uploadedAt: string };

export function CvUploader({ files }: { files: CvFileMeta[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const files = Array.from(input?.files ?? []);
    if (files.length === 0) return;

    startTransition(async () => {
      const failed: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.set("file", file);
        try {
          await uploadCv(formData);
        } catch (err) {
          failed.push(`${file.name}: ${err instanceof Error ? err.message : "error"}`);
        }
      }
      if (failed.length > 0) setError(failed.join(" — "));
      formRef.current?.reset();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteCv(id);
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display font-semibold text-text">Mis CVs (PDF)</h2>
      <p className="text-sm text-text-muted">
        Subí uno o más CVs en PDF como referencia. La IA usa tu perfil de arriba, no el PDF, para generar CVs nuevos.
      </p>
      <form ref={formRef} onSubmit={handleSubmit} className="flex items-center gap-3">
        <input
          type="file"
          name="file"
          accept="application/pdf"
          multiple
          required
          className="text-sm text-text file:mr-3 file:bg-accent file:text-accent-ink file:border-0 file:rounded file:px-3 file:py-2 file:text-sm file:font-medium"
        />
        <button
          type="submit"
          disabled={isPending}
          className="bg-surface border border-border rounded px-3 py-2 text-sm text-text hover:border-text-muted transition disabled:opacity-50"
        >
          Subir
        </button>
      </form>
      {error && <p className="text-sm text-status-discarded">{error}</p>}

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2"
            >
              <a
                href={`/api/cv/file/${f.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent underline underline-offset-4 truncate"
              >
                {f.filename}
              </a>
              <button
                type="button"
                onClick={() => handleDelete(f.id)}
                disabled={isPending}
                className="text-sm text-status-discarded shrink-0 ml-3"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
