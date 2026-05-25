"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/lib/auth/session";
import { getSignInPathForArea, resolveAreaAccess } from "@/modules/auth";
import { apiPost } from "@/lib/api/server-fetch";
import { t } from "@/lib/translations";

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function buildRedirect(pathname: string, params: Record<string, string>) {
  return `${pathname}?${new URLSearchParams(params).toString()}`;
}

function requireStudentSession() {
  return getAuthSession().then((session) => {
    const decision = resolveAreaAccess({ area: "student", session });

    if (!decision.allowed) {
      redirect(decision.reason === "unauthenticated" ? getSignInPathForArea("student") : decision.redirectTo);
    }

    return session!;
  });
}

export async function submitStudentPracticeAction(formData: FormData) {
  const session = await requireStudentSession();
  const publicationId = getStringValue(formData, "publicationId");

  try {
    await apiPost(`/api/v1/student/assignment-results/${publicationId}/start-practice`, {
      publicationId,
      fixturePath: getStringValue(formData, "fixturePath"),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(
      buildRedirect(`/student/assignments/${publicationId}/submit`, {
        error: error instanceof Error ? error.message : t.api.submissionActions.couldNotCreatePracticeSubmission,
      }),
    );
  }

  revalidatePath("/student/assignments");
  revalidatePath(`/student/assignments/${publicationId}/submit`);
  redirect(buildRedirect(`/student/assignments/${publicationId}/submit`, { submitted: "1" }));
}
