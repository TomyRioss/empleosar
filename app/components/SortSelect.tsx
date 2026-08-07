"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function SortSelect({ currentSort }: { currentSort?: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const sp = new URLSearchParams(params.toString());
    sp.set("sort", e.target.value);
    router.push(`/?${sp.toString()}`);
  }

  return (
    <select
      value={currentSort || "recent"}
      onChange={handleChange}
      className="bg-transparent text-sm text-text-muted focus:outline-none cursor-pointer"
    >
      <option value="recent">Más recientes</option>
      <option value="oldest">Más antiguos</option>
    </select>
  );
}
