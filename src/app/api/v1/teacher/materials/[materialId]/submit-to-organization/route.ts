/**
 * POST /api/v1/teacher/materials/{materialId}/submit-to-organization — Submit material for organization approval.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const submitSchema = z.object({
  organizationId: z.string().uuid(),
});

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const materialId = params.materialId as string;

      const body = await request.json();
      const validation = submitSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid submission data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { organizationId } = validation.data;
      const supabase = createServerClient();

      // Fetch material to verify ownership
      const { data: material, error: fetchError } = await supabase
        .from("materials")
        .select("id, scope_type, owner_teacher_id, status")
        .eq("id", materialId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !material) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Material not found."),
        );
      }

      // Verify the teacher owns this personal material
      if (material.scope_type !== "personal" || material.owner_teacher_id !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You can only submit your own personal materials for organization approval."),
        );
      }

      // Verify teacher is a member of the target organization
      const { data: membership, error: membershipError } = await supabase
        .from("organization_memberships")
        .select("id, status")
        .eq("organization_id", organizationId)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (membershipError) {
        console.error("[teacher/materials/submit] Membership check error:", membershipError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify organization membership."),
        );
      }

      if (!membership || membership.status !== "active") {
        return toResponse(
          errorResponse(
            ErrorCodes.FORBIDDEN,
            "You must be an active member of the organization to submit materials for approval.",
          ),
        );
      }

      // Check the material's approval history to enforce one-org lifetime rules.
      const { data: existingApprovals, error: approvalsError } = await supabase
        .from("material_approvals")
        .select("id, decision, organization_id")
        .eq("material_id", materialId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (approvalsError) {
        console.error("[teacher/materials/submit] Approval history fetch error:", approvalsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify approval history."),
        );
      }

      const approvals = existingApprovals ?? [];
      const conflictingOrganizationApproval = approvals.find(
        (approval) => approval.organization_id !== null && approval.organization_id !== organizationId,
      );

      if (conflictingOrganizationApproval) {
        return toResponse(
          errorResponse(
            ErrorCodes.CONFLICT,
            "This material has already been submitted to a different organization.",
          ),
        );
      }

      const existingPendingApproval = approvals.find((approval) => approval.decision === "pending");

      if (existingPendingApproval) {
        return toResponse(
          errorResponse(
            ErrorCodes.CONFLICT,
            "This material already has a pending approval request.",
          ),
        );
      }

      // Create approval request
      const { data: approval, error: approvalError } = await supabase
        .from("material_approvals")
        .insert({
          material_id: materialId,
          organization_id: organizationId,
          requested_by_platform_user_id: session.userId,
          decision: "pending",
        })
        .select("id, material_id, organization_id, decision, created_at")
        .single();

      if (approvalError || !approval) {
        console.error("[teacher/materials/submit] Approval creation error:", approvalError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create approval request."),
        );
      }

      return toResponse(
        successResponse({
          approvalId: approval.id,
          materialId: approval.material_id,
          organizationId: approval.organization_id,
          decision: approval.decision,
          requestedAt: approval.created_at,
          message: "Material submitted for organization approval.",
        }),
        201,
      );
    } catch (err) {
      console.error("[teacher/materials/submit] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to submit material for approval."),
      );
    }
  },
  { requiredRole: "teacher" },
);
