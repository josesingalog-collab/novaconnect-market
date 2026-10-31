import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
        {children}
      </div>
      <SiteFooter />
    </>
  );
}
