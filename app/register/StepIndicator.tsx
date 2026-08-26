"use client";

import { FaCheck } from "react-icons/fa6";

export function StepIndicator({
  steps,
  currentIndex,
}: {
  steps: string[];
  currentIndex: number;
}) {
  return (
    <ol className="flex items-start gap-1 sm:gap-2 mb-8" aria-label="Progreso del registro">
      {steps.map((label, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li key={label} className="flex-1 flex flex-col items-center gap-2 min-w-0">
            <div className="flex items-center w-full">
              <div className={`h-px flex-1 ${i === 0 ? "opacity-0" : done ? "bg-accent" : "bg-border"}`} />
              <div
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] transition-colors ${
                  done
                    ? "bg-accent text-accent-ink"
                    : current
                      ? "border-2 border-accent text-accent bg-surface"
                      : "border border-border text-text-muted bg-surface"
                }`}
                aria-current={current ? "step" : undefined}
              >
                {done ? <FaCheck size={9} /> : i + 1}
              </div>
              <div className={`h-px flex-1 ${i === steps.length - 1 ? "opacity-0" : done ? "bg-accent" : "bg-border"}`} />
            </div>
            <span
              className={`font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-center leading-tight ${
                current ? "text-text font-medium" : "text-text-muted"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
