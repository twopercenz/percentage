"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronIcon } from "@/components/ui/icons";
import type { TocEntry } from "@/lib/namumark/renderer";

function TocList({ entries }: { entries: TocEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <ul className="ml-4 list-none">
      {entries.map((entry) => (
        <li key={entry.anchorId} className="py-0.5">
          <Link
            href={`#${entry.anchorId}`}
            className="text-sm text-[var(--accent)] hover:text-[var(--accent-secondary)]"
          >
            {entry.number} {entry.title}
          </Link>
          <TocList entries={entry.children} />
        </li>
      ))}
    </ul>
  );
}

// 접기/펼치기 상태가 있는 인터랙티브 컴포넌트라 클라이언트 컴포넌트로 둔다.
export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  const [open, setOpen] = useState(true);

  if (entries.length === 0) return null;

  return (
    <div className="my-4 inline-block rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 text-sm font-bold text-[var(--foreground)]"
      >
        목차
        <ChevronIcon className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open ? <TocList entries={entries} /> : null}
    </div>
  );
}
