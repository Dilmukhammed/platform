"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/lib/auth/session";
import { getSignInPathForArea, resolveAreaAccess } from "@/modules/auth";
import { apiPost } from "@/lib/api/server-fetch";
import { t } from "@/lib/translations";

function requireTeacherSession() {
  return getAuthSession().then((session) => {
    const decision = resolveAreaAccess({ area: "teacher", session });

    if (!decision.allowed) {
      redirect(decision.reason === "unauthenticated" ? getSignInPathForArea("teacher") : decision.redirectTo);
    }

    return session!;
  });
}

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function buildRedirect(pathname: string, key: string, value: string) {
  const params = new URLSearchParams({ [key]: value });
  return `${pathname}?${params.toString()}`;
}

export async function createClassAction(formData: FormData) {
  const session = await requireTeacherSession();

  try {
    await apiPost("/api/v1/teacher/classes", {
      name: getStringValue(formData, "name"),
      description: getStringValue(formData, "description"),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : t.api.classActions.couldNotCreateClass;
    redirect(buildRedirect("/teacher/classes", "error", message));
  }

  revalidatePath("/teacher/classes");
  redirect(buildRedirect("/teacher/classes", "created", "1"));
}

export async function rotateJoinCodeAction(formData: FormData) {
  const session = await requireTeacherSession();
  const classId = getStringValue(formData, "classId");
  const redirectPath = getStringValue(formData, "redirectPath") || `/teacher/classes/${classId}`;

  try {
    await apiPost(`/api/v1/teacher/classes/${classId}/join-codes/rotate`, {});
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : t.api.classActions.couldNotRotateJoinCode;
    redirect(buildRedirect(redirectPath, "error", message));
  }

  revalidatePath("/teacher/classes");
  revalidatePath(`/teacher/classes/${classId}`);
  redirect(buildRedirect(redirectPath, "rotated", "1"));
}
