"use client";

import Link from "next/link";
import { useRef } from "react";
import { FaUser, FaFileAlt } from "react-icons/fa";

export function UserMenu({ name }: { name: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function close() {
    detailsRef.current?.removeAttribute("open");
  }

  return (
    <details ref={detailsRef} className="relative">
      <summary
        className="list-none cursor-pointer text-sm text-text font-medium underline decoration-2 underline-offset-4 hover:text-accent [&::-webkit-details-marker]:hidden"
      >
        {name}
      </summary>
      <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-lg shadow-sm py-1 z-20">
        <Link
          href="/profile"
          onClick={close}
          className="flex items-center gap-2.5 px-3 py-2 text-sm text-text hover:bg-surface-alt"
        >
          <FaUser size={13} className="text-text-muted" />
          Perfil
        </Link>
        <Link
          href="/cv"
          onClick={close}
          className="flex items-center gap-2.5 px-3 py-2 text-sm text-text hover:bg-surface-alt"
        >
          <FaFileAlt size={13} className="text-text-muted" />
          CVs Generados
        </Link>
      </div>
    </details>
  );
}
