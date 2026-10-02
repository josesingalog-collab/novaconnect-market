import type { ReactNode } from "react";
import { requireRole } from "@/lib/guards";
import { getCurrentProfile } from "@/lib/profile";
import { VendorShell } from "@/components/vendor/vendor-shell";

export default async function VendorLayout({ children }: { children: ReactNode }) {
  await requireRole("VENDOR", "/vendor");
  const current = await getCurrentProfile();

  return (
    <VendorShell profile={current.kind === "ok" ? current.profile : null}>{children}</VendorShell>
  );
}
