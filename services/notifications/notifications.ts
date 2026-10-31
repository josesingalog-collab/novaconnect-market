/**
 * Notifications in-app — Phase 9 S5+.
 *
 * Lecture RLS de `notifications` (policy notifications_select_own) :
 * le destinataire est résolu serveur par auth.uid(), jamais passable
 * par le client. Les écritures applicatives se limitent à read_at
 * (garde SQL guard_notification_payload) et DELETE own.
 */
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";

export interface NotificationRecord {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string | null;
  readonly link: string | null;
  readonly readAt: string | null;
  readonly createdAt: string;
}

const MAX_PAGE_LIMIT = 50;

export async function listNotifications(limit: number = 20): Promise<NotificationRecord[]> {
  const current = await getCurrentProfile();
  if (current.kind !== "ok") {
    throw new Error("Non authentifié");
  }

  const safeLimit = Math.min(Math.max(1, limit), MAX_PAGE_LIMIT);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error !== null) {
    throw new Error("Impossible de charger vos notifications.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const current = await getCurrentProfile();
  if (current.kind !== "ok") {
    return 0;
  }

  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error !== null) {
    throw new Error("Impossible de compter vos notifications.");
  }

  return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const parsed = z.uuid().safeParse(notificationId);
  if (!parsed.success) {
    throw new Error("Identifiant de notification invalide.");
  }

  const current = await getCurrentProfile();
  if (current.kind !== "ok") {
    throw new Error("Non authentifié");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data);

  if (error !== null) {
    throw new Error(error.message || "Impossible de marquer la notification comme lue.");
  }
}

export async function markAllNotificationsRead(): Promise<number> {
  const current = await getCurrentProfile();
  if (current.kind !== "ok") {
    throw new Error("Non authentifié");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .select("id");

  if (error !== null) {
    throw new Error(error.message || "Impossible de marquer toutes les notifications comme lues.");
  }

  return (data ?? []).length;
}
