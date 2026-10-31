"use server";

import {
  markAllNotificationsRead as markAllNotificationsReadService,
  markNotificationRead as markNotificationReadService,
} from "@/services/notifications/notifications";
import { revalidatePath } from "next/cache";

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  await markNotificationReadService(notificationId);
  revalidatePath("/dashboard/notifications");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  await markAllNotificationsReadService();
  revalidatePath("/dashboard/notifications");
}
