import type { ReactNode } from "react";
import type { UserProfile } from "@/lib/profile";
import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";

interface AdminShellProps {
  children: ReactNode;
  profile: UserProfile | null;
}

export function AdminShell({ children, profile }: AdminShellProps) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <AdminSidebar />
      <main id="main-content" className="min-h-screen w-full flex-1 pb-20 lg:ml-60 lg:pb-0">
        <AdminHeader profile={profile} />
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
