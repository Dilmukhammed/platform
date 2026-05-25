"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getAuthSession } from "@/lib/auth/session";
import { getSignInPathForArea, resolveAreaAccess } from "@/modules/auth";
import { apiPost } from "@/lib/api/server-fetch";
import { t } from "@/lib/translations";

function requireRole(area: "teacher" | "admin") {
  return getAuthSession().then((session) => {
    const decision = resolveAreaAccess({ area, session });

    if (!decision.allowed) {
      redirect(decision.reason === "unauthenticated" ? getSignInPathForArea(area) : decision.redirectTo);
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

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function submitOrganizationRequestAction(formData: FormData) {
  const session = await requireRole("teacher");
  const name = getStringValue(formData, "name").trim();

  if (name.length < 3) {
    redirect(buildRedirect("/organization/request", "error", t.api.organizationActions.organizationNameMin));
  }

  const slug = slugify(name) || "organization";

  try {
    await apiPost("/api/v1/teacher/organizations", { name, slug });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : t.api.organizationActions.couldNotCreateOrganizationRequest;
    redirect(buildRedirect("/organization/request", "error", message));
  }

  revalidatePath("/organization/request");
  revalidatePath("/teacher/organizations");
  revalidatePath("/admin/organizations");
  revalidatePath("/admin/organization-approvals");
  redirect(buildRedirect("/teacher/organizations", "requested", "1"));
}

export async function selectTeacherOrganizationAction(formData: FormData) {
  const session = await requireRole("teacher");
  const organizationId = getStringValue(formData, "organizationId");

  // API validates membership + org status
  try {
    await apiPost("/api/v1/teacher/organizations/select", { organizationId });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : t.api.organizationActions.couldNotSelectOrganization;
    redirect(buildRedirect("/teacher/organizations", "error", message));
  }

  // Set cookie directly — API call is internal so Set-Cookie doesn't reach browser
  const cookieStore = await cookies();
  cookieStore.set("teacher_selected_org", organizationId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
    secure: process.env.NODE_ENV === "production" && process.env.AUTH_COOKIE_INSECURE !== "1",
  });

  revalidatePath("/teacher/organizations");
  redirect(buildRedirect("/teacher/organizations", "selected", organizationId));
}

export async function inviteTeacherAction(formData: FormData) {
  const session = await requireRole("teacher");
  const organizationId = getStringValue(formData, "organizationId");
  const email = getStringValue(formData, "email").trim();

  if (!email || !email.includes("@")) {
    redirect(buildRedirect("/teacher/organizations", "error", t.api.organizationActions.validEmailRequired));
  }

  try {
    await apiPost(`/api/v1/teacher/organizations/${organizationId}/invites`, {
      email,
      role: "teacher",
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : t.api.organizationActions.couldNotSendInvite;
    redirect(buildRedirect("/teacher/organizations", "error", message));
  }

  revalidatePath("/teacher/organizations");
  redirect(buildRedirect("/teacher/organizations", "invited", email));
}
