"use server";

import { redirect } from "next/navigation";

import { clearAuthSession, writeAuthSession } from "@/lib/auth/session";
import { authenticateStaff, authenticateStudent, getHomePathForRole } from "@/modules/auth";
import { t } from "@/lib/translations";

function getStringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function buildErrorRedirect(pathname: string, message: string) {
  const params = new URLSearchParams({ error: message });
  return `${pathname}?${params.toString()}`;
}

export async function signInStaffAction(formData: FormData) {
  const result = await authenticateStaff({
    email: getStringValue(formData, "email"),
    password: getStringValue(formData, "password"),
  });

  if (!result.ok) {
    redirect(buildErrorRedirect("/auth/teacher/sign-in", result.error));
  }

  await writeAuthSession(result.session);
  redirect(getHomePathForRole(result.session.role));
}

export async function signInStudentAction(formData: FormData) {
  const result = await authenticateStudent({
    studentLogin: getStringValue(formData, "studentLogin"),
    pin: getStringValue(formData, "pin"),
  });

  if (!result.ok) {
    redirect(buildErrorRedirect("/auth/student/login", result.error));
  }

  await writeAuthSession(result.session);
  redirect(getHomePathForRole(result.session.role));
}

export async function createStudentProfileAction(formData: FormData) {
  const firstName = getStringValue(formData, "firstName");
  const lastName = getStringValue(formData, "lastName");
  const middleName = getStringValue(formData, "middleName");
  const pin = getStringValue(formData, "pin");

  // Client-side validation
  const errors: Record<string, string> = {};

  if (!firstName || firstName.length < 2) {
    errors.firstName = t.api.authActions.firstNameMin;
  }

  if (!lastName || lastName.length < 2) {
    errors.lastName = t.api.authActions.lastNameMin;
  }

  if (!pin || !/^\d{4}$/.test(pin)) {
    errors.pin = t.api.authActions.pinExactDigits;
  }

  if (Object.keys(errors).length > 0) {
    const params = new URLSearchParams();
    Object.entries(errors).forEach(([field, message]) => {
      params.append(`error_${field}`, message);
    });
    redirect(`/auth/student/create-profile?${params.toString()}`);
  }

  // NEXT_PUBLIC_APP_URL is required for server-side fetch in production
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL environment variable is required in production");
  }

  // Call API to create profile
  const baseUrl = appUrl || "http://localhost:3000";
  const response = await fetch(
    `${baseUrl}/api/v1/student/auth/create-profile`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, middleName, pin }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const errorMessage = data?.error?.message || t.api.authActions.failedToCreateProfile;
    redirect(buildErrorRedirect("/auth/student/create-profile", errorMessage));
  }

  // Profile created and session cookie set by API
  redirect("/student");
}

export async function signUpStaffAction(formData: FormData) {
  const name = getStringValue(formData, "name");
  const email = getStringValue(formData, "email");
  const password = getStringValue(formData, "password");
  const confirmPassword = getStringValue(formData, "confirmPassword");

  // Client-side validation
  const errors: Record<string, string> = {};

  if (!name || name.length < 2) {
    errors.name = t.api.authActions.nameMin;
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = t.api.authActions.validEmail;
  }

  if (!password || password.length < 8) {
    errors.password = t.api.authActions.passwordMin;
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = t.api.authActions.passwordsMismatch;
  }

  if (Object.keys(errors).length > 0) {
    const params = new URLSearchParams();
    Object.entries(errors).forEach(([field, message]) => {
      params.append(`error_${field}`, message);
    });
    redirect(`/auth/teacher/sign-up?${params.toString()}`);
  }

  // For now, redirect to sign-in with a message that registration is not yet implemented
  // In a real implementation, this would call an API to create the teacher account
  redirect(buildErrorRedirect("/auth/teacher/sign-in", t.api.authActions.accountCreatedPleaseSignIn));
}

export async function acceptInviteAction(formData: FormData) {
  const inviteToken = getStringValue(formData, "inviteToken");

  if (!inviteToken) {
    redirect(buildErrorRedirect("/auth/teacher/invite/accept", t.api.authActions.invalidInviteToken));
  }

  // Call the API to accept the invite
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  if (!process.env.NEXT_PUBLIC_APP_URL && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL environment variable is required in production");
  }
  const response = await fetch(
    `${baseUrl}/api/v1/teacher/organizations/join-by-invite`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteToken }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const errorCode = data?.error?.code;
    const errorMessage = data?.error?.message || t.api.authActions.failedToAcceptInvitation;

    // Map API error codes to invite states
    switch (errorCode) {
      case "RESOURCE_NOT_FOUND":
        redirect(buildErrorRedirect("/auth/teacher/invite/accept", t.api.authActions.invalidOrExpiredInviteToken));
      case "FORBIDDEN":
        redirect(buildErrorRedirect("/auth/teacher/invite/accept", t.api.authActions.invitationExpired));
      case "CONFLICT":
        redirect(buildErrorRedirect("/auth/teacher/invite/accept", t.api.authActions.alreadyMember));
      default:
        redirect(buildErrorRedirect("/auth/teacher/invite/accept", errorMessage));
    }
  }

  // Invite accepted successfully
  redirect("/teacher");
}

export async function signOutAction() {
  await clearAuthSession();
  redirect("/");
}
