/**
 * POST /api/v1/admin/material-approvals/{approvalId}/reject — Reject a material.
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

      // Check if approval exists and is pending
      const { data: approval, error: fetchError } = await supabase
        .from("material_approvals")
        .select("id, material_id, decision, requested_by_platform_user_id, materials(id, title, status)")
        .eq("id", approvalId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !approval) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Material approval request not found."),
        );
      }

      if (approval.decision !== "pending") {
        return toResponse(
          errorResponse(
            ErrorCodes.CONFLICT,
            `Material approval is already ${approval.decision}.`,
          ),
        );
      }

      // Update approval decision — atomic guard: only update if still pending
      const { data: updatedApproval, error: updateError } = await supabase
        .from("material_approvals")
        .update({
          decision: "rejected",
          decision_reason: reason,
          reviewed_by_platform_user_id: session.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", approvalId)
        .eq("decision", "pending")
        .select("id, material_id, decision, decision_reason, reviewed_by_platform_user_id, reviewed_at, updated_at")
        .single();

      if (updateError) {
        console.error("[admin/material-approvals/reject] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to reject material."),
        );
      }

      if (!updatedApproval) {
        // No rows matched — approval was already processed concurrently
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "Material approval has already been processed."),
        );
      }

      // Rejection only returns the material to a draft state; ownership/scope semantics stay as submitted.
      const { error: materialUpdateError } = await supabase
        .from("materials")
        .update({ status: "draft" })
        .eq("id", approval.material_id)
        .is("deleted_at", null);

      if (materialUpdateError) {
        console.error("[admin/material-approvals/reject] Material update error:", materialUpdateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to reset rejected material to draft."),
        );
      }

      // Notify the teacher who submitted the material
      if (approval.requested_by_platform_user_id) {
        const rawMaterialForNotify = approval.materials;
        const materialForNotify = (Array.isArray(rawMaterialForNotify) ? rawMaterialForNotify[0] : rawMaterialForNotify) as Record<string, unknown> | null;

        const { error: notifyError } = await supabase
          .from("notifications")
          .insert({
            recipient_type: "platform_user",
            recipient_platform_user_id: approval.requested_by_platform_user_id,
            type: "material_rejected",
            payload_json: {
              materialId: approval.material_id,
              materialTitle: materialForNotify?.title ?? null,
              approvalId,
              rejectionReason: reason,
              message: "Your material submission has been rejected",
            },
          });

        if (notifyError) {
          console.error("[admin/material-approvals/reject] Error creating notification:", notifyError);
          // Don't fail the request if notification fails
        }
      }

      // Supabase may return joined data as an object or single-element array depending on relationship.
      // Normalize to a single object for property access.
      const rawMaterial = approval.materials;
      const material = (Array.isArray(rawMaterial) ? rawMaterial[0] : rawMaterial) as Record<string, unknown> | null;

      return toResponse(
        successResponse({
          approvalId: updatedApproval.id,
          materialId: updatedApproval.material_id,
          title: material?.title,
          decision: updatedApproval.decision,
          rejectionReason: updatedApproval.decision_reason,
          reviewedBy: updatedApproval.reviewed_by_platform_user_id,
          reviewedAt: updatedApproval.reviewed_at,
          updatedAt: updatedApproval.updated_at,
        }),
        200,
      );
    } catch (err) {
      console.error("[admin/material-approvals/reject] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to reject material."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
