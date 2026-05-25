"use server";

import { revalidatePath } from "next/cache";

import { requireAreaAccess } from "@/lib/auth/guards";
import { apiPost } from "@/lib/api/server-fetch";

export async function markNotificationReadAction(notificationId: string) {
  const session = await requireAreaAccess("student");

  await apiPost(`/api/v1/student/notifications/${notificationId}/read`, {});

  revalidatePath("/student/notifications");
}

export async function markTeacherNotificationReadAction(formData: FormData) {
  await requireAreaAccess("teacher");
  const notificationId = String(formData.get("notificationId") ?? "").trim();

  if (!notificationId) {
    return;
  }

  await apiPost(`/api/v1/teacher/notifications/${notificationId}/read`, {});

  revalidatePath("/teacher/notifications");
}
