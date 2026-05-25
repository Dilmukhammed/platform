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

function getStringValues(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value : ""));
}

function buildRedirect(pathname: string, params: Record<string, string>) {
  return `${pathname}?${new URLSearchParams(params).toString()}`;
}

function requireTeacherSession() {
  return getAuthSession().then((session) => {
    const decision = resolveAreaAccess({ area: "teacher", session });

    if (!decision.allowed) {
      redirect(decision.reason === "unauthenticated" ? getSignInPathForArea("teacher") : decision.redirectTo);
    }

    return session!;
  });
}

function revalidatePublicationPaths(templateId: string, publicationId: string) {
  revalidatePath("/teacher/assignments");
  revalidatePath(`/teacher/assignments/${templateId}/publish`);
  revalidatePath("/teacher/publications");
  revalidatePath(`/teacher/publications/${publicationId}`);
}

export async function publishAssignmentTemplateAction(formData: FormData) {
  const session = await requireTeacherSession();
  const templateId = getStringValue(formData, "templateId");
  const allClassIds = getStringValues(formData, "targetClassId");
  const selectedClassIds = new Set(getStringValues(formData, "classId").filter(Boolean));
  const deadlineValues = getStringValues(formData, "deadlineOverride");
  const deadlineOverrides = allClassIds.reduce<Record<string, string | undefined>>((accumulator, classId, index) => {
    accumulator[classId] = deadlineValues[index] ?? "";
    return accumulator;
  }, {});

  let publicationId: string;

  try {
    const result = await apiPost<{ id: string }>(
      `/api/v1/teacher/assignment-templates/${templateId}/publications`,
      {
        defaultDeadline: getStringValue(formData, "defaultDeadline"),
        classIds: allClassIds.filter((classId) => selectedClassIds.has(classId)),
        deadlineOverrides,
      },
    );
    publicationId = result.id;
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect(
      buildRedirect(`/teacher/assignments/${templateId}/publish`, {
        error: error instanceof Error ? error.message : t.api.publicationActions.couldNotPublishAssignmentTemplate,
      }),
    );
  }

  revalidatePublicationPaths(templateId, publicationId);
  redirect(buildRedirect(`/teacher/publications/${publicationId}`, { created: "1" }));
}
