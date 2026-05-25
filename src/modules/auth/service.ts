import "server-only";

import { comparePin } from "@/lib/crypto/pin-hash";
import bcrypt from "bcryptjs";
import { createServerClient } from "@/lib/supabase/server-client";
import { t } from "@/lib/translations";

import { bootstrapStaffAccounts, bootstrapStudentAccounts } from "./bootstrap-data";
import type { AccessDecision, AuthResult, AuthRole, AuthenticatedSession, ProtectedArea } from "./types";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeStudentLogin(studentLogin: string) {
  return studentLogin.trim().toUpperCase();
}

export function getHomePathForRole(role: AuthRole) {
  switch (role) {
    case "teacher":
      return "/teacher";
    case "student":
      return "/student";
    case "super_admin":
      return "/admin";
  }
}

export function getSignInPathForArea(area: Exclude<ProtectedArea, "public">) {
  switch (area) {
    case "student":
      return "/auth/student/login";
    case "teacher":
    case "admin":
      return "/auth/teacher/sign-in";
  }
}

function isMissingSupabaseEnvError(error: unknown) {
  return error instanceof Error && error.message.startsWith("Missing required environment variable:");
}

function getBootstrapStudentAuthLookup(studentLogin: string) {
  return bootstrapStudentAccounts.find((candidate) => candidate.studentLogin === studentLogin) ?? null;
}

export async function authenticateStaff(input: { email: string; password: string }): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  const password = input.password.trim();

  // In development mode, try bootstrap first for known accounts
  if (process.env.NODE_ENV === "development") {
    const bootstrapAccount = bootstrapStaffAccounts.find((candidate) => candidate.email === email);
    if (bootstrapAccount) {
      console.warn("[auth] Using bootstrap fallback for development account");
      return authenticateStaffBootstrap(input);
    }
  }

  // Try Supabase Auth
  try {
    const supabase = createServerClient();

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

      if (authError || !authData.user) {
        // In development, fall back to bootstrap if Supabase auth fails
        if (process.env.NODE_ENV === "development") {
          console.warn("[auth] Supabase auth failed, trying bootstrap fallback");
          return authenticateStaffBootstrap(input);
        }
        return { ok: false, error: t.api.authService.invalidEmailOrPassword };
      }

    // Fetch role/displayName from platform_users
    const { data: platformUser, error: platformError } = await supabase
      .from("platform_users")
      .select("id, role, display_name, status")
      .eq("auth_user_id", authData.user.id)
      .single();

    if (platformError || !platformUser) {
      return { ok: false, error: t.api.authService.accountNotFound };
    }

    if (platformUser.status !== "active") {
      return { ok: false, error: t.api.authService.accountNotActive };
    }

    return {
      ok: true,
      session: {
        userId: platformUser.id,
        role: platformUser.role,
        displayName: platformUser.display_name,
        loginIdentifier: email,
      },
    };
  } catch (error) {
    // Fall back to bootstrap in development
    if (process.env.NODE_ENV === "development") {
      console.warn("[auth] Using bootstrap fallback - Supabase error:", error);
      return authenticateStaffBootstrap(input);
    }
    throw error;
  }
}

// Extract existing bootstrap logic to separate function
async function authenticateStaffBootstrap(input: { email: string; password: string }): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  const password = input.password.trim();

  const account = bootstrapStaffAccounts.find((candidate) => candidate.email === email);

  if (!account || account.status !== "active") {
    return { ok: false, error: t.api.authService.invalidEmailOrPassword };
  }

  const matches = await bcrypt.compare(password, account.passwordHash);
  if (!matches) {
    return { ok: false, error: t.api.authService.invalidEmailOrPassword };
  }

  return {
    ok: true,
    session: {
      userId: account.id,
      role: account.role,
      displayName: account.displayName,
      loginIdentifier: account.email,
    },
  };
}

export async function authenticateStudent(input: { studentLogin: string; pin: string }): Promise<AuthResult> {
  const studentLogin = normalizeStudentLogin(input.studentLogin);
  const pin = input.pin.trim();

  try {
    const supabase = createServerClient();

    const { data: profiles, error: profileError } = await supabase
      .from("student_profiles")
      .select("id, student_login, display_name, status, student_credentials(id, pin_hash, status)")
      .eq("student_login", studentLogin)
      .is("deleted_at", null)
      .limit(1);

    if (profileError || !profiles || profiles.length === 0) {
      return {
        ok: false,
        error: t.api.authService.studentLoginOrPinIncorrect,
      };
    }

    const profile = profiles[0] as Record<string, unknown>;
    const credentials = (profile.student_credentials as unknown as Record<string, unknown>[])?.[0];

    if (!credentials || credentials.status !== "active" || profile.status !== "active") {
      return {
        ok: false,
        error: t.api.authService.studentLoginOrPinIncorrect,
      };
    }

    const pinHash = credentials.pin_hash as string;
    const { matches } = await comparePin(pin, pinHash);

    if (!matches) {
      return {
        ok: false,
        error: t.api.authService.studentLoginOrPinIncorrect,
      };
    }

    return {
      ok: true,
      session: {
        userId: profile.id as string,
        role: "student",
        displayName: (profile.display_name as string) || studentLogin,
        loginIdentifier: profile.student_login as string,
      },
    };
  } catch (error) {
    // Fallback to local bootstrap data when Supabase is not configured — DEVELOPMENT ONLY.
    if (
      process.env.NODE_ENV !== "production" &&
      error instanceof Error &&
      error.message.startsWith("Missing required environment variable:")
    ) {
      const account = getBootstrapStudentAuthLookup(studentLogin);

      if (!account || account.status !== "active") {
        return {
          ok: false,
          error: t.api.authService.studentLoginOrPinIncorrect,
        };
      }

      const { matches } = await comparePin(pin, account.pinHash);
      if (!matches) {
        return {
          ok: false,
          error: t.api.authService.studentLoginOrPinIncorrect,
        };
      }

      return {
        ok: true,
        session: {
          userId: account.id,
          role: "student",
          displayName: account.displayName,
          loginIdentifier: account.studentLogin,
        },
      };
    }

    return {
      ok: false,
      error: t.api.authService.studentLoginOrPinIncorrect,
    };
  }
}

export function resolveAreaAccess(input: {
  area: ProtectedArea;
  session: AuthenticatedSession | null;
}): AccessDecision {
  const { area, session } = input;

  if (area === "public") {
    if (!session) {
      return { allowed: true };
    }

    return {
      allowed: false,
      redirectTo: getHomePathForRole(session.role),
      reason: "role_mismatch",
    };
  }

  if (!session) {
    return {
      allowed: false,
      redirectTo: getSignInPathForArea(area),
      reason: "unauthenticated",
    };
  }

  const expectedRole: AuthRole = area === "admin" ? "super_admin" : area;

  if (session.role !== expectedRole) {
    return {
      allowed: false,
      redirectTo: getHomePathForRole(session.role),
      reason: "role_mismatch",
    };
  }

  return { allowed: true };
}
