import type { ReactNode } from "react";
import { requireRole } from "@/lib/guards";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const profile = await requireRole("ADMIN", "/admin");

  return <AdminShell profile={profile}>{children}</AdminShell>;
}
