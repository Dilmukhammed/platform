/**
 * POST /api/v1/admin/organizations/{organizationId}/approve — Approve a pending organization.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const organizationId = params.organizationId as string;

      const supabase = createServerClient();

      // Check if organization exists and is pending
      const { data: organization, error: orgError } = await supabase
        .from("organizations")
        .select("id, status, created_by_platform_user_id")
        .eq("id", organizationId)
        .is("deleted_at", null)
        .single();

      if (orgError || !organization) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Organization not found."),
        );
      }

      if (organization.status !== "pending") {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Organization is not in pending status."),
        );
      }

      const approvedAt = new Date().toISOString();

      // Update organization status
      const { error: updateError } = await supabase
        .from("organizations")
        .update({
          status: "active",
          approved_by_platform_user_id: session.userId,
          approved_at: approvedAt,
          updated_at: approvedAt,
        })
        .eq("id", organizationId);

      if (updateError) {
        console.error("[admin/organizations/approve] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to approve organization."),
        );
      }

      // Update membership status for the creator
      const { error: membershipError } = await supabase
        .from("organization_memberships")
        .update({
          status: "active",
          updated_at: approvedAt,
        })
        .eq("organization_id", organizationId)
        .eq("platform_user_id", organization.created_by_platform_user_id);

      if (membershipError) {
        console.error("[admin/organizations/approve] Membership update error:", membershipError);
        // Don't fail the request, but log the error
      }

      return toResponse(
        successResponse({
          organizationId,
          status: "active",
          approvedAt,
          approvedBy: session.userId,
        }),
      );
    } catch (err) {
      console.error("[admin/organizations/approve] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to approve organization."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
