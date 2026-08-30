"use client";

import { type ReactNode } from "react";
import { SidebarNav } from "./sidebar-nav";
import { MobileNav } from "./mobile-nav";
import { VendorHeader } from "./vendor-header";

export interface VendorShellProps {
  children: ReactNode;
}

export function VendorShell({ children }: VendorShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <SidebarNav />
      <MobileNav />
      <main id="main-content" className="min-h-screen flex-1 lg:ml-60">
        <VendorHeader />
        <div className="lg:p-6 p-4">{children}</div>
      </main>
    </div>
  );
}