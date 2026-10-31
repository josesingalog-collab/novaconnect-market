import Link from "next/link";
import { getCurrentProfile } from "@/lib/profile";
import { getUnreadNotificationCount } from "@/services/notifications/notifications";

/**
 * Cloche de notifications (Server Component) : badge pointille non-bloquant.
 * En cas d'erreur (table pas encore migrée…), le lien s'affiche sans badge.
 */
export async function NotificationBell() {
  const current = await getCurrentProfile();
  if (current.kind !== "ok") {
    return null;
  }

  let unread = 0;
  try {
    unread = await getUnreadNotificationCount();
  } catch {
    unread = 0;
  }

  return (
    <Link
      href="/dashboard/notifications"
      aria-label={`Notifications${unread > 0 ? ` (${unread} non lue${unread > 1 ? "s" : ""})` : ""}`}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.7V5a2 2 0 1 0-4 0v0.3A6 6 0 0 0 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"
        />
      </svg>
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
