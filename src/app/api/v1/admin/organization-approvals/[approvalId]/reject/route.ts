/**
 * POST /api/v1/admin/organization-approvals/{approvalId}/reject — Reject an organization.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const rejectSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const approvalId = params.approvalId as string;

      const body = await request.json();
      const validation = rejectSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid request data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { reason } = validation.data;
      const supabase = createServerClient();

      // Check if organization exists and is pending
      const { data: organization, error: fetchError } = await supabase
        .from("organizations")
        .select("id, name, status, approved_by_platform_user_id, approved_at")
        .eq("id", approvalId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !organization) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Organization approval request not found."),
        );
      }

      if (organization.status !== "pending") {
        return toResponse(
          errorResponse(
            ErrorCodes.CONFLICT,
            `Organization is already ${organization.status}.`,
          ),
        );
      }

      // Update organization status to rejected (using suspended as rejected state)
      const { data: updatedOrg, error: updateError } = await supabase
        .from("organizations")
        .update({
          status: "suspended",
          approved_by_platform_user_id: session.userId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", approvalId)
        .select("id, name, slug, status, approved_by_platform_user_id, approved_at, updated_at")
        .single();

      if (updateError || !updatedOrg) {
        console.error("[admin/organization-approvals/reject] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to reject organization."),
        );
      }

      return toResponse(
        successResponse({
          approvalId: updatedOrg.id,
          organizationId: updatedOrg.id,
          name: updatedOrg.name,
          slug: updatedOrg.slug,
          status: updatedOrg.status,
          rejectionReason: reason,
          decidedBy: updatedOrg.approved_by_platform_user_id,
          decidedAt: updatedOrg.approved_at,
          updatedAt: updatedOrg.updated_at,
        }),
        200,
      );
    } catch (err) {
      console.error("[admin/organization-approvals/reject] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to reject organization."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
