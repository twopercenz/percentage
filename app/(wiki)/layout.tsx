import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

export default function WikiLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">{children}</div>
      <Sidebar />
    </div>
  );
}
