/**
 * GET /api/v1/session — Bootstrap endpoint.
 *
 * Returns the current session state: principal, role, scopes,
 * memberships (organizations + classes), and onboarding state.
 * Works for both authenticated and unauthenticated users.
 */

import { getAuthSession } from "@/lib/auth/session";
import { writeAuthSession } from "@/lib/auth/session";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";
import { authenticateStaff } from "@/modules/auth";
import type { AuthRole } from "@/modules/auth/types";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { z } from "zod/v4";

type OnboardingState = "active" | "pending_approval" | "no_org";

type OrganizationMembership = {
  id: string;
  role: string;
  name?: string;
  status?: string;
};

type ClassMembership = {
  id: string;
  role?: string;
  title?: string;
};

type SessionBootstrapData = {
  authenticated: boolean;
  principal: {
    id: string;
    type: AuthRole;
    displayName: string;
  } | null;
  role: AuthRole | null;
  scopes: string[];
  memberships: {
    organizations: OrganizationMembership[];
    classes: ClassMembership[];
  };
  onboarding: {
    state: OnboardingState;
  };
};

const signInSchema = z.object({
  email: z.string().trim().email("Email is required."),
  password: z.string().min(1, "Password is required."),
});

function isMissingSupabaseEnvError(error: unknown) {
  return error instanceof Error && error.message.startsWith("Missing required environment variable:");
}

function buildScopes(role: AuthRole | null): string[] {
  if (!role) return [];

  const scopes: string[] = [role];

  if (role === "teacher") {
    scopes.push("organization:read", "organization:write", "class:read", "class:write");
  }

  if (role === "super_admin") {
    scopes.push("organization:read", "organization:write", "class:read", "class:write", "admin:full");
  }

  if (role === "student") {
    scopes.push("class:read", "assignment:read", "result:read");
  }

  return scopes;
}

async function fetchTeacherMemberships(
  userId: string,
): Promise<{ organizations: OrganizationMembership[]; classes: ClassMembership[] }> {
  const supabase = createServerClient();

  const [orgResult, classResult] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("id, organization_id, role, status, organizations(id, name, status)")
      .eq("platform_user_id", userId)
      .is("deleted_at", null)
      .in("status", ["active", "pending"]),
    supabase
      .from("class_teachers")
      .select("id, class_id, role, is_primary, classes(id, title)")
      .eq("platform_user_id", userId)
      .is("deleted_at", null)
      .eq("status", "active"),
  ]);

  const organizations: OrganizationMembership[] = (orgResult.data ?? []).map((row) => ({
    id: (row.organizations as unknown as { id: string })?.id ?? row.organization_id,
    role: row.role,
    name: (row.organizations as unknown as { name: string })?.name,
    status: row.status,
  }));

  const classes: ClassMembership[] = (classResult.data ?? []).map((row) => ({
    id: (row.classes as unknown as { id: string })?.id ?? row.class_id,
    role: row.role,
    title: (row.classes as unknown as { title: string })?.title,
  }));

  return { organizations, classes };
}

async function fetchStudentMemberships(
  studentProfileId: string,
): Promise<{ organizations: OrganizationMembership[]; classes: ClassMembership[] }> {
  const supabase = createServerClient();

  const [orgResult, classResult] = await Promise.all([
    supabase
      .from("organization_students")
      .select("id, organization_id, status, organizations(id, name, status)")
      .eq("student_profile_id", studentProfileId)
      .is("deleted_at", null)
      .in("status", ["active", "blocked"]),
    supabase
      .from("class_enrollments")
      .select("id, class_id, status, classes(id, title)")
      .eq("student_profile_id", studentProfileId)
      .is("deleted_at", null)
      .eq("status", "active"),
  ]);

  const organizations: OrganizationMembership[] = (orgResult.data ?? []).map((row) => ({
    id: (row.organizations as unknown as { id: string })?.id ?? row.organization_id,
    role: "student",
    name: (row.organizations as unknown as { name: string })?.name,
    status: row.status,
  }));

  const classes: ClassMembership[] = (classResult.data ?? []).map((row) => ({
    id: (row.classes as unknown as { id: string })?.id ?? row.class_id,
    title: (row.classes as unknown as { title: string })?.title,
  }));

  return { organizations, classes };
}

function determineOnboardingState(
  organizations: OrganizationMembership[],
): OnboardingState {
  if (organizations.length === 0) {
    return "no_org";
  }

  const hasPending = organizations.some(
    (org) => org.status === "pending",
  );

  if (hasPending) {
    return "pending_approval";
  }

  return "active";
}

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session) {
      const data: SessionBootstrapData = {
        authenticated: false,
        principal: null,
        role: null,
        scopes: [],
        memberships: { organizations: [], classes: [] },
        onboarding: { state: "no_org" },
      };

      return toResponse(successResponse(data));
    }

    let memberships: { organizations: OrganizationMembership[]; classes: ClassMembership[] } = {
      organizations: [],
      classes: [],
    };
    let usedBootstrapMembershipFallback = false;

    try {
      if (session.role === "student") {
        memberships = await fetchStudentMemberships(session.userId);
      } else {
        memberships = await fetchTeacherMemberships(session.userId);
      }
    } catch (error) {
      if (!isMissingSupabaseEnvError(error)) {
        throw error;
      }

      usedBootstrapMembershipFallback = true;
    }

    const onboardingState = usedBootstrapMembershipFallback && session.role !== "student"
      ? "active"
      : determineOnboardingState(memberships.organizations);

    const data: SessionBootstrapData = {
      authenticated: true,
      principal: {
        id: session.userId,
        type: session.role,
        displayName: session.displayName,
      },
      role: session.role,
      scopes: buildScopes(session.role),
      memberships,
      onboarding: { state: onboardingState },
    };

    return toResponse(successResponse(data));
  } catch (error) {
    console.error("[session] Error building bootstrap payload:", error);
    return toResponse(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to retrieve session state."),
    );
  }
}

async function sessionPostHandler(request: Request) {
  try {
    const body = await request.json();
    const parsed = signInSchema.safeParse(body);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      // Use the first validation error as the main message for better UX
      const firstError = details[0];
      const mainMessage = firstError 
        ? `${firstError.field === "email" ? "Email" : firstError.field === "password" ? "Password" : firstError.field} ${firstError.message.toLowerCase()}`
        : "Invalid request body.";

      return toResponse(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          mainMessage,
          undefined,
          details,
        ),
      );
    }

    const result = await authenticateStaff(parsed.data);

    if (!result.ok) {
      return toResponse(
        errorResponse(ErrorCodes.UNAUTHORIZED, result.error),
      );
    }

    await writeAuthSession(result.session);

    return toResponse(
      successResponse({
        authenticated: true,
        principal: {
          id: result.session.userId,
          type: result.session.role,
          displayName: result.session.displayName,
        },
        role: result.session.role,
      }),
    );
  } catch (error) {
    console.error("[session] Error creating auth session:", error);
    return toResponse(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create session."),
    );
  }
}

export const POST = rateLimitMiddleware(sessionPostHandler);
