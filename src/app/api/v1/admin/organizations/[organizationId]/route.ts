/**
 * GET /api/v1/admin/organizations/{organizationId} — Get organization details.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient, getAuthUserEmails } from "@/lib/supabase/server-client";

export const GET = withAuth(
  async (request, context) => {
    try {
      const params = await context.params;
      const organizationId = params.organizationId as string;

      const supabase = createServerClient();

      // Get auth user emails (cross-schema join doesn't work via JS client)
      const authEmails = await getAuthUserEmails();

      // Fetch organization details
      const { data: organization, error: orgError } = await supabase
        .from("organizations")
        .select(
          `
          id,
          name,
          slug,
          status,
          created_by_platform_user_id,
          approved_by_platform_user_id,
          approved_at,
          created_at,
          updated_at,
          platform_users!organizations_created_by_platform_user_id_fkey(
            id,
            auth_user_id,
            display_name
          )
        `,
        )
        .eq("id", organizationId)
        .is("deleted_at", null)
        .single();

      if (orgError || !organization) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Organization not found."),
        );
      }

      // Fetch membership count
      const { count: membershipCount, error: membershipError } = await supabase
        .from("organization_memberships")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .is("deleted_at", null);

      if (membershipError) {
        console.error("[admin/organizations/detail] Membership count error:", membershipError);
      }

      // Fetch class count
      const { count: classCount, error: classError } = await supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .is("deleted_at", null);

      if (classError) {
        console.error("[admin/organizations/detail] Class count error:", classError);
      }

      // Fetch student count
      const { count: studentCount, error: studentError } = await supabase
        .from("organization_students")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .is("deleted_at", null);

      if (studentError) {
        console.error("[admin/organizations/detail] Student count error:", studentError);
      }

      const creator = (Array.isArray(organization.platform_users) ? organization.platform_users[0] : organization.platform_users) as Record<string, unknown> | null | undefined;

      return toResponse(
        successResponse({
          organizationId: organization.id,
          name: organization.name,
          slug: organization.slug,
          status: organization.status,
          createdBy: creator
            ? {
                userId: creator.id,
                email: creator.auth_user_id ? (authEmails.get(creator.auth_user_id as string) ?? null) : null,
                displayName: creator.display_name,
              }
            : null,
          approvedBy: organization.approved_by_platform_user_id,
          approvedAt: organization.approved_at,
          stats: {
            membershipCount: membershipCount ?? 0,
            classCount: classCount ?? 0,
            studentCount: studentCount ?? 0,
          },
          createdAt: organization.created_at,
          updatedAt: organization.updated_at,
        }),
      );
    } catch (err) {
      console.error("[admin/organizations/detail] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch organization details."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
