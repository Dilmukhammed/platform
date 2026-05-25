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

function requireRole(area: "teacher" | "admin") {
  return getAuthSession().then((session) => {
    const decision = resolveAreaAccess({ area, session });

    if (!decision.allowed) {
      redirect(decision.reason === "unauthenticated" ? getSignInPathForArea(area) : decision.redirectTo);
    }

    return session!;
  });
}

function revalidateMaterialPaths() {
  revalidatePath("/teacher/materials");
  revalidatePath("/teacher/library");
  revalidatePath("/teacher/library/school/materials");
  revalidatePath("/admin/material-approvals");
}

export async function submitMaterialToSchoolAction(formData: FormData) {
  const session = await requireRole("teacher");
  const materialId = getStringValue(formData, "materialId");
  const organizationId = getStringValue(formData, "organizationId");

  if (!organizationId) {
    redirect(
      buildRedirect("/teacher/materials", {
        error: t.api.materialActions.noOrganizationSelected,
      }),
    );
  }

  try {
    await apiPost(`/api/v1/teacher/materials/${materialId}/submit-to-organization`, {
      organizationId,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(
      buildRedirect("/teacher/materials", {
        error: error instanceof Error ? error.message : t.api.materialActions.couldNotSubmitMaterial,
      }),
    );
  }

  revalidateMaterialPaths();
  redirect(buildRedirect("/teacher/materials", { submitted: materialId || "1" }));
}

export async function approveSchoolMaterialAction(formData: FormData) {
  const session = await requireRole("admin");
  const materialId = getStringValue(formData, "materialId");

  try {
    await apiPost(`/api/v1/admin/material-approvals/${materialId}/approve`, {});
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(
      buildRedirect("/admin/material-approvals", {
        error: error instanceof Error ? error.message : t.api.materialActions.couldNotApproveMaterial,
      }),
    );
  }

  revalidateMaterialPaths();
  redirect(buildRedirect("/admin/material-approvals", { approved: materialId || "1" }));
}

export async function rejectSchoolMaterialAction(formData: FormData) {
  const session = await requireRole("admin");
  const materialId = getStringValue(formData, "materialId");

  try {
    await apiPost(`/api/v1/admin/material-approvals/${materialId}/reject`, {
      reason: getStringValue(formData, "reason"),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(
      buildRedirect("/admin/material-approvals", {
        error: error instanceof Error ? error.message : t.api.materialActions.couldNotRejectMaterial,
      }),
    );
  }

  revalidateMaterialPaths();
  redirect(buildRedirect("/admin/material-approvals", { rejected: materialId || "1" }));
}
