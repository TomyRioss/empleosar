"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KEYWORD_CATEGORIES } from "./keywordCategories";

type Keyword = {
  id: string;
  term: string;
};

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function KeywordSelect({ keywords, defaultValue }: { keywords: Keyword[]; defaultValue?: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(defaultValue || "");
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(term: string) {
    setSelected(term);
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (term) {
      params.set("keyword", term);
    } else {
      params.delete("keyword");
    }
    router.push(`/?${params.toString()}`);
  }

  const selectedLabel = selected ? capitalize(selected) : "Todos";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-bg border border-border rounded px-2 py-2 text-sm text-text text-left focus:outline-none focus:ring-2 focus:ring-accent flex items-center justify-between"
      >
        <span className="truncate">{selectedLabel}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" className="shrink-0 ml-2">
          <path fill="currentColor" d="M6 8L1 3h10z" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto">
          <button
            type="button"
            onClick={() => handleSelect("")}
            className={`w-full px-3 py-2 text-sm text-left hover:bg-surface-alt transition ${!selected ? "text-accent" : "text-text"}`}
          >
            Todos
          </button>

          {KEYWORD_CATEGORIES.map(({ name, icon: Icon, terms }) => {
            const matched = keywords.filter((k) => terms.includes(k.term));
            if (matched.length === 0) return null;

            return (
              <div key={name}>
                <div className="px-3 py-1.5 border-t border-border font-mono text-[10px] uppercase tracking-wider text-text-muted flex items-center gap-2">
                  <Icon className="shrink-0" />
                  <span>{name}</span>
                </div>
                {matched.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => handleSelect(k.term)}
                    className={`w-full px-3 py-2 pl-9 text-sm text-left hover:bg-surface-alt transition ${selected === k.term ? "text-accent" : "text-text"}`}
                  >
                    {capitalize(k.term)}
                  </button>
                ))}
              </div>
            );
          })}

          {keywords
            .filter((k) => !KEYWORD_CATEGORIES.flatMap(({ terms }) => terms).includes(k.term))
            .map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => handleSelect(k.term)}
                className={`w-full px-3 py-2 text-sm text-left hover:bg-surface-alt transition ${selected === k.term ? "text-accent" : "text-text"}`}
              >
                {capitalize(k.term)}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
