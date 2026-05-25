/**
 * GET /api/v1/admin/organizations/pending — List pending organization approvals.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient, getAuthUserEmails } from "@/lib/supabase/server-client";

interface PendingOrganizationApproval {
  organizationId: string;
  organizationName: string;
  slug: string;
  type: string;
  description: string | null;
  requestedByTeacherName: string;
  requestedByTeacherEmail: string;
  requestedAt: string;
}

export const GET = withAuth(
  async () => {
    try {
      const supabase = createServerClient();

      // Get auth user emails (cross-schema join doesn't work via JS client)
      const authEmails = await getAuthUserEmails();

      // Get pending organizations with their creators
      const { data: organizations, error } = await supabase
        .from("organizations")
        .select(
          `
          id,
          name,
          slug,
          status,
          created_at,
          platform_users!organizations_created_by_platform_user_id_fkey(
            id,
            auth_user_id,
            display_name
          )
        `,
        )
        .eq("status", "pending")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[admin/organizations/pending] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch pending organizations."),
        );
      }

      // Transform to response format
      const pendingApprovals: PendingOrganizationApproval[] = (organizations ?? []).map((org) => {
        const creator = (Array.isArray(org.platform_users) ? org.platform_users[0] : org.platform_users) as Record<string, unknown> | null | undefined;

        return {
          organizationId: org.id,
          organizationName: org.name,
          slug: org.slug,
          type: "school", // Default type
          description: null,
          requestedByTeacherName: (creator?.display_name as string) ?? "Unknown",
          requestedByTeacherEmail: creator?.auth_user_id
            ? (authEmails.get(creator.auth_user_id as string) ?? "Unknown")
            : "Unknown",
          requestedAt: org.created_at,
        };
      });

      return toResponse(successResponse(pendingApprovals));
    } catch (err) {
      console.error("[admin/organizations/pending] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch pending organizations."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
