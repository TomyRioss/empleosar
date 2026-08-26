"use client";

import { useState } from "react";

const labelClass = "font-mono text-[11px] uppercase tracking-widest text-text-muted";

export function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const value = draft.trim();
    setDraft("");
    if (!value || values.includes(value)) return;
    onChange([...values, value]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  function removeAt(i: number) {
    onChange(values.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-1">
      <label className={labelClass}>{label}</label>
      <div className="bg-surface border border-border rounded px-2 py-2 flex flex-col gap-1.5 focus-within:ring-2 focus-within:ring-accent">
        {values.map((v, i) => (
          <span
            key={i}
            className="w-full flex items-center justify-between gap-1 bg-surface-alt border border-border rounded px-2 py-1 text-sm text-text"
          >
            {v}
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Quitar ${v}`}
              className="text-text-muted hover:text-status-discarded leading-none shrink-0"
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="w-full bg-transparent text-sm text-text focus:outline-none py-0.5"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={values.length === 0 ? placeholder : undefined}
        />
      </div>
    </div>
  );
}
