"use client";

import { useRouter } from "next/navigation";

export function SortSelect({ currentSort }: { currentSort?: string }) {
  const router = useRouter();

  return (
    <select
      defaultValue={currentSort || "recent"}
      className="bg-bg border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:ring-2 focus:ring-accent"
      onChange={(e) => {
        const params = new URLSearchParams(window.location.search);
        params.set("sort", e.target.value);
        router.push(`/?${params.toString()}`);
      }}
    >
      <option value="recent">Más recientes</option>
      <option value="oldest">Más antiguos</option>
    </select>
  );
}
