import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/profile";
import { listNotifications } from "@/services/notifications/notifications";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Mes notifications",
  robots: { index: false, follow: false },
};

const TYPE_LABELS: Record<string, { label: string; className: string }> = {
  "order.paid": {
    label: "Commande",
    className: "bg-emerald-100 text-emerald-800",
  },
  "vendor.sale": {
    label: "Vente",
    className: "bg-emerald-100 text-emerald-800",
  },
  "withdrawal.approved": {
    label: "Retrait",
    className: "bg-sky-100 text-sky-800",
  },
  "withdrawal.processing": {
    label: "Retrait",
    className: "bg-sky-100 text-sky-800",
  },
  "withdrawal.paid": {
    label: "Retrait",
    className: "bg-emerald-100 text-emerald-800",
  },
  "withdrawal.rejected": {
    label: "Retrait",
    className: "bg-rose-100 text-rose-800",
  },
  "withdrawal.cancelled": {
    label: "Retrait",
    className: "bg-zinc-100 text-zinc-600",
  },
  "product.published": {
    label: "Produit",
    className: "bg-emerald-100 text-emerald-800",
  },
  "product.rejected": {
    label: "Produit",
    className: "bg-amber-100 text-amber-800",
  },
  "vendor.approved": {
    label: "Boutique",
    className: "bg-emerald-100 text-emerald-800",
  },
  "vendor.suspended": {
    label: "Boutique",
    className: "bg-rose-100 text-rose-800",
  },
  "vendor.rejected": {
    label: "Boutique",
    className: "bg-amber-100 text-amber-800",
  },
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function NotificationsPage() {
  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
        <Alert variant="warning" title="Connexion requise">
          <Link href="/login?next=/dashboard/notifications">Connectez-vous</Link> pour consulter vos
          notifications.
        </Alert>
      </main>
    );
  }

  if (current.kind === "missing-profile") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
        <Alert variant="error" title="Profil introuvable">
          Déconnectez-vous puis reconnectez-vous pour réessayer.
        </Alert>
      </main>
    );
  }

  let notifications: Awaited<ReturnType<typeof listNotifications>> = [];
  let loadError = false;
  try {
    notifications = await listNotifications(50);
  } catch {
    loadError = true;
  }

  const unread = notifications.filter((n) => n.readAt === null).length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Mes notifications" }]} />
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Mes notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paiements, ventes, retraits et statuts de vos produits et de votre boutique.
          </p>
        </div>
        {unread > 0 && (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="outline" size="sm">
              Tout marquer comme lu ({unread})
            </Button>
          </form>
        )}
      </div>

      {loadError ? (
        <Alert variant="error" title="Erreur">
          Impossible de charger votre boîte de notifications. Réessayez plus tard.
        </Alert>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="Aucune notification pour le moment"
          description="Vous serez notifié dès qu'un paiement, une vente ou un changement de statut vous concerne."
          action={{ label: "Explorer le catalogue", href: "/catalogue" }}
        />
      ) : (
        <ul
          className="flex flex-col divide-y divide-border rounded-xl border border-border bg-background"
          aria-label="Liste des notifications"
        >
          {notifications.map((notification) => {
            const badge = TYPE_LABELS[notification.type] ?? {
              label: "Info",
              className: "bg-muted text-muted-foreground",
            };
            const unreadItem = notification.readAt === null;
            const title = (
              <span
                className={[
                  "text-sm",
                  unreadItem ? "font-semibold text-foreground" : "text-foreground/80",
                ].join(" ")}
              >
                {notification.title}
              </span>
            );
            return (
              <li
                key={notification.id}
                className={[
                  "flex items-start gap-3 p-4",
                  unreadItem ? "bg-primary/[0.03]" : "",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "mt-2 h-2 w-2 shrink-0 rounded-full",
                    unreadItem ? "bg-primary" : "bg-transparent",
                  ].join(" ")}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        badge.className,
                      ].join(" ")}
                    >
                      {badge.label}
                    </span>
                    {notification.link === null ? (
                      title
                    ) : (
                      <Link href={notification.link} className="hover:underline">
                        {title}
                      </Link>
                    )}
                  </div>
                  {notification.body && (
                    <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    {formatDate(notification.createdAt)}
                  </p>
                </div>
                {unreadItem && (
                  <form action={markNotificationReadAction.bind(null, notification.id)}>
                    <Button type="submit" variant="ghost" size="sm" aria-label="Marquer comme lue">
                      Marquer lue
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
