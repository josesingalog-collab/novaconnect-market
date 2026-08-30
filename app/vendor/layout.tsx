import type { ReactNode } from "react";
import { requireRole } from "@/lib/guards";
import { VendorShell } from "@/components/vendor/vendor-shell";

export default async function VendorLayout({ children }: { children: ReactNode }) {
  await requireRole("VENDOR", "/vendor");

  return (
    <VendorShell>
      {children}
    </VendorShell>
  );
}