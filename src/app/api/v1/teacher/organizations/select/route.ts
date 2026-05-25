/**
 * POST /api/v1/teacher/organizations/select — Set currently selected organization.
 *
 * Verifies the teacher has an active membership in the requested org,
 * then sets the teacher_selected_org cookie.
 */

import { z } from "zod/v4";
import { cookies } from "next/headers";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const SELECTED_ORG_COOKIE = "teacher_selected_org";

const selectOrgSchema = z.object({
  organizationId: z.string().uuid(),
});

export const POST = withAuth(
  async (request, _context, { session }) => {
    try {
      const body = await request.json();
      const validation = selectOrgSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid organization selection data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { organizationId } = validation.data;
      const supabase = createServerClient();

      // Verify the teacher has an active membership AND the org itself is active
      const { data: membership, error: verifyError } = await supabase
        .from("organization_memberships")
        .select("id, status, organization:organizations!inner ( id, status )")
        .eq("platform_user_id", session.userId)
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();

      if (verifyError) {
        console.error("[teacher/organizations/select] Verify error:", verifyError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify organization membership."),
        );
      }

      if (!membership) {
        return toResponse(
          errorResponse(
            ErrorCodes.FORBIDDEN,
            "You do not have an active membership in this organization.",
          ),
        );
      }

      // Check that the organization itself is approved (not pending)
      const orgStatus = (membership.organization as unknown as { status: string }).status;
      if (orgStatus !== "active") {
        return toResponse(
          errorResponse(
            ErrorCodes.FORBIDDEN,
            "This organization is not yet approved. Please wait for admin approval.",
          ),
        );
      }

      // Set the cookie
      const cookieStore = await cookies();
      cookieStore.set(SELECTED_ORG_COOKIE, organizationId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 86400,
        secure: process.env.NODE_ENV === "production" && process.env.AUTH_COOKIE_INSECURE !== "1",
      });

      return toResponse(
        successResponse({ organizationId }),
      );
    } catch (err) {
      console.error("[teacher/organizations/select] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to select organization."),
      );
    }
  },
  { requiredRole: "teacher" },
);
