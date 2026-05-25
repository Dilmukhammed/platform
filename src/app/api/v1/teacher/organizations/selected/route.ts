/**
 * GET /api/v1/teacher/organizations/selected — Get currently selected organization.
 *
 * Reads the teacher_selected_org cookie. If absent, returns the first active
 * org membership for the teacher.
 */

import { cookies } from "next/headers";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const SELECTED_ORG_COOKIE = "teacher_selected_org";

export const GET = withAuth(
  async (_request, _context, { session }) => {
    try {
      const cookieStore = await cookies();
      const selectedOrgId = cookieStore.get(SELECTED_ORG_COOKIE)?.value;

      const supabase = createServerClient();

      // If a cookie exists, verify the teacher still has an active membership
      if (selectedOrgId) {
        const { data: membership, error: verifyError } = await supabase
          .from("organization_memberships")
          .select("id, organization_id, role, status, organizations!inner(id, name, slug)")
          .eq("platform_user_id", session.userId)
          .eq("organization_id", selectedOrgId)
          .eq("status", "active")
          .is("deleted_at", null)
          .is("organizations.deleted_at", null)
          .maybeSingle();

        if (verifyError) {
          console.error("[teacher/organizations/selected] Verify error:", verifyError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify selected organization."),
          );
        }

        if (membership) {
          const org = membership.organizations as unknown as Record<string, unknown> | null;
          return toResponse(
            successResponse({
              organizationId: org?.id ?? membership.organization_id,
              organizationName: org?.name,
              organizationSlug: org?.slug,
            }),
          );
        }

        // Cookie is stale — fall through to first active membership
      }

      // No cookie or stale cookie: return first active membership
      const { data: firstMembership, error: fetchError } = await supabase
        .from("organization_memberships")
        .select("id, organization_id, role, status, organizations!inner(id, name, slug)")
        .eq("platform_user_id", session.userId)
        .eq("status", "active")
        .is("deleted_at", null)
        .is("organizations.deleted_at", null)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error("[teacher/organizations/selected] Fetch error:", fetchError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch organizations."),
        );
      }

      if (!firstMembership) {
        return toResponse(
          successResponse({
            organizationId: null,
            organizationName: null,
            organizationSlug: null,
          }),
        );
      }

      const org = firstMembership.organizations as unknown as Record<string, unknown> | null;
      return toResponse(
        successResponse({
          organizationId: org?.id ?? firstMembership.organization_id,
          organizationName: org?.name,
          organizationSlug: org?.slug,
        }),
      );
    } catch (err) {
      console.error("[teacher/organizations/selected] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to get selected organization."),
      );
    }
  },
  { requiredRole: "teacher" },
);
