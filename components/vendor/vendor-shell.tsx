import type { ReactNode } from "react";
import type { UserProfile } from "@/lib/profile";
import { SidebarNav } from "./sidebar-nav";
import { MobileNav } from "./mobile-nav";
import { VendorHeader } from "./vendor-header";

interface VendorShellProps {
  children: ReactNode;
  profile: UserProfile | null;
  collapsed?: boolean;
}

export function VendorShell({ children, profile, collapsed }: VendorShellProps) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <SidebarNav collapsed={collapsed} />
      <MobileNav />
      <main
        id="main-content"
        className={["min-h-screen w-full flex-1 pb-20 lg:pb-0", collapsed ? "lg:ml-16" : "lg:ml-60"]
          .filter(Boolean)
          .join(" ")}
      >
        <VendorHeader profile={profile} collapsed={collapsed} />
        <div className="animate-fade-in bg-background p-4 lg:min-h-[calc(100vh-4rem)] lg:p-8">{children}</div>
      </main>
    </div>
  );
}
