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

function requireTeacherSession() {
  return getAuthSession().then((session) => {
    const decision = resolveAreaAccess({ area: "teacher", session });

    if (!decision.allowed) {
      redirect(decision.reason === "unauthenticated" ? getSignInPathForArea("teacher") : decision.redirectTo);
    }

    return session!;
  });
}

export async function createStudentAction(formData: FormData) {
  const session = await requireTeacherSession();
  const classId = getStringValue(formData, "classId");

  try {
    const result = await apiPost<{
      studentLogin: string;
      displayName: string;
      className?: string;
    }>(`/api/v1/teacher/classes/${classId}/students`, {
      studentLogin: getStringValue(formData, "studentLogin") || undefined,
      firstName: getStringValue(formData, "firstName"),
      lastName: getStringValue(formData, "lastName"),
      pin: getStringValue(formData, "pin"),
    });

    revalidatePath("/teacher/students");
    revalidatePath("/teacher/classes");
    revalidatePath(`/teacher/classes/${classId}`);
    redirect(
      buildRedirect("/teacher/students", {
        created: "1",
        login: result.studentLogin,
        student: result.displayName,
        className: result.className || classId,
      }),
    );
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(
      buildRedirect("/teacher/students", {
        error: error instanceof Error ? error.message : t.api.studentActions.couldNotCreateStudent,
      }),
    );
  }
}

export async function importStudentsAction(formData: FormData) {
  const session = await requireTeacherSession();
  const csvFileValue = formData.get("csvFile");
  let csvText = getStringValue(formData, "csvText");

  if (!csvText && csvFileValue instanceof File) {
    csvText = await csvFileValue.text();
  }

  try {
    await apiPost("/api/v1/teacher/students/import", { csvText });
    revalidatePath("/teacher/students");
    revalidatePath("/teacher/classes");
    redirect(buildRedirect("/teacher/students", { imported: "1" }));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(
      buildRedirect("/teacher/students", {
        error: error instanceof Error ? error.message : t.api.studentActions.couldNotImportStudents,
      }),
    );
  }
}

export async function selfJoinClassAction(formData: FormData) {
  try {
    const result = await apiPost<{
      result: string;
      studentLogin: string;
      displayName: string;
      className: string;
      classId: string;
    }>("/api/v1/student/classes/join-by-code", {
      joinCode: getStringValue(formData, "joinCode"),
      existingStudentLogin: getStringValue(formData, "existingStudentLogin") || undefined,
      firstName: getStringValue(formData, "firstName") || undefined,
      lastName: getStringValue(formData, "lastName") || undefined,
      pin: getStringValue(formData, "pin") || undefined,
    });

    revalidatePath("/teacher/classes");
    revalidatePath(`/teacher/classes/${result.classId}`);
    redirect(
      buildRedirect("/join", {
        joined: result.result,
        login: result.studentLogin,
        student: result.displayName,
        className: result.className,
      }),
    );
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(
      buildRedirect("/join", {
        error: error instanceof Error ? error.message : t.api.studentActions.couldNotJoinClass,
      }),
    );
  }
}
