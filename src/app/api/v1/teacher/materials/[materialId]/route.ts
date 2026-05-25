/**
 * GET /api/v1/teacher/materials/{materialId} — Get material details.
 * PATCH /api/v1/teacher/materials/{materialId} — Update material.
 * DELETE /api/v1/teacher/materials/{materialId} — Soft delete material.
 */

import { z } from "zod/v4";
import { cookies } from "next/headers";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";
import { getMaterialSchoolVisibilityStateForOrganization } from "@/modules/materials/school-visibility";

const SELECTED_ORG_COOKIE = "teacher_selected_org";

type ReviewState = "none" | "pending" | "approved" | "rejected";

function computeReviewState(decision: string | null | undefined): ReviewState {
  if (!decision) return "none";
  if (decision === "pending") return "pending";
  if (decision === "approved") return "approved";
  if (decision === "rejected") return "rejected";
  return "none";
}

const updateMaterialSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  sourceFilePath: z.string().min(1).max(500).optional(),
});

// GET — Get material details
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const materialId = params.materialId as string;

      const supabase = createServerClient();

      // Fetch material (no approval join — canonical helper handles that)
      const { data: material, error } = await supabase
        .from("materials")
        .select("*")
        .eq("id", materialId)
        .is("deleted_at", null)
        .single();

      if (error || !material) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Material not found."),
        );
      }

      // Check ownership/permissions
      if (material.scope_type === "personal") {
        if (material.owner_teacher_id !== session.userId) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this material."),
          );
        }
      } else if (material.scope_type === "organization") {
        // Check if teacher is a member of the organization
        const { data: membership } = await supabase
          .from("organization_memberships")
          .select("id")
          .eq("organization_id", material.owner_organization_id)
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null)
          .maybeSingle();

        if (!membership) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this material."),
          );
        }
      }

      // Resolve selected organization for review state computation
      const cookieStore = await cookies();
      const cookieOrgId = cookieStore.get(SELECTED_ORG_COOKIE)?.value ?? null;

      let selectedOrgId: string | null = null;

      if (cookieOrgId) {
        const { data: cookieMembership } = await supabase
          .from("organization_memberships")
          .select("id")
          .eq("platform_user_id", session.userId)
          .eq("organization_id", cookieOrgId)
          .eq("status", "active")
          .is("deleted_at", null)
          .maybeSingle();

        if (cookieMembership) {
          selectedOrgId = cookieOrgId;
        }
      }

      if (!selectedOrgId) {
        const { data: firstMembership } = await supabase
          .from("organization_memberships")
          .select("organization_id")
          .eq("platform_user_id", session.userId)
          .eq("status", "active")
          .is("deleted_at", null)
          .order("joined_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (firstMembership) {
          selectedOrgId = firstMembership.organization_id;
        }
      }

      // Compute review state using canonical helper
      const visibilityState = await getMaterialSchoolVisibilityStateForOrganization(supabase, {
        materialId,
        organizationId: selectedOrgId,
      });

      const latestApproval = visibilityState.latestApproval;
      const reviewState = computeReviewState(latestApproval?.decision);
      const latestDecision = latestApproval && latestApproval.decision !== "pending"
        ? latestApproval.decision
        : null;

      // Fetch decision_reason separately (helper doesn't include it)
      let latestDecisionReason: string | null = null;
      if (latestApproval && latestApproval.decision !== "pending") {
        const { data: approvalRow } = await supabase
          .from("material_approvals")
          .select("decision_reason")
          .eq("id", latestApproval.approvalId)
          .single();

        latestDecisionReason = approvalRow?.decision_reason ?? null;
      }

      return toResponse(
        successResponse({
          materialId: material.id,
          title: material.title,
          description: material.description,
          scopeType: material.scope_type,
          ownerTeacherId: material.owner_teacher_id,
          ownerOrganizationId: material.owner_organization_id,
          status: material.status,
          sourceFilePath: material.source_file_path,
          createdAt: material.created_at,
          updatedAt: material.updated_at,
          reviewState,
          latestDecision,
          latestDecisionReason,
          schoolVisible: visibilityState.isSchoolVisible,
          submittedAt: latestApproval?.createdAt ?? null,
          decidedAt: latestApproval && latestApproval.decision !== "pending"
            ? latestApproval.reviewedAt ?? null
            : null,
        }),
      );
    } catch (err) {
      console.error("[teacher/materials/[materialId]] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch material."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// PATCH — Update material
export const PATCH = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const materialId = params.materialId as string;

      const body = await request.json();
      const validation = updateMaterialSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid material data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const supabase = createServerClient();

      // Fetch material to check ownership
      const { data: material, error: fetchError } = await supabase
        .from("materials")
        .select("id, scope_type, owner_teacher_id, owner_organization_id, status")
        .eq("id", materialId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !material) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Material not found."),
        );
      }

      // Check ownership/permissions
      if (material.scope_type === "personal") {
        if (material.owner_teacher_id !== session.userId) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have permission to update this material."),
          );
        }
      } else if (material.scope_type === "organization") {
        // Check if teacher is a member of the organization
        const { data: membership } = await supabase
          .from("organization_memberships")
          .select("id, role")
          .eq("organization_id", material.owner_organization_id)
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null)
          .maybeSingle();

        if (!membership) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have permission to update this material."),
          );
        }

        // For organization materials, only owners/admins can update
        if (membership.role !== "owner" && membership.role !== "manager") {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "Only organization owners or admins can update organization materials."),
          );
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (validation.data.title !== undefined) updateData.title = validation.data.title;
      if (validation.data.description !== undefined) updateData.description = validation.data.description;
      if (validation.data.status !== undefined) updateData.status = validation.data.status;
      if (validation.data.sourceFilePath !== undefined) updateData.source_file_path = validation.data.sourceFilePath;
      updateData.updated_at = new Date().toISOString();

      const { data: updatedMaterial, error: updateError } = await supabase
        .from("materials")
        .update(updateData)
        .eq("id", materialId)
        .is("deleted_at", null)
        .select("id, title, description, scope_type, owner_teacher_id, owner_organization_id, status, source_file_path, created_at, updated_at")
        .single();

      if (updateError || !updatedMaterial) {
        console.error("[teacher/materials/[materialId]] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update material."),
        );
      }

      return toResponse(
        successResponse({
          materialId: updatedMaterial.id,
          title: updatedMaterial.title,
          description: updatedMaterial.description,
          scopeType: updatedMaterial.scope_type,
          ownerTeacherId: updatedMaterial.owner_teacher_id,
          ownerOrganizationId: updatedMaterial.owner_organization_id,
          status: updatedMaterial.status,
          sourceFilePath: updatedMaterial.source_file_path,
          createdAt: updatedMaterial.created_at,
          updatedAt: updatedMaterial.updated_at,
        }),
      );
    } catch (err) {
      console.error("[teacher/materials/[materialId]] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update material."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// DELETE — Soft delete material
export const DELETE = withAuth(
  async (_request, context, { session }) => {
    try {
      const params = await context.params;
      const materialId = params.materialId as string;

      const supabase = createServerClient();

      const { data: material, error: fetchError } = await supabase
        .from("materials")
        .select("id, scope_type, owner_teacher_id, owner_organization_id")
        .eq("id", materialId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !material) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Material not found."),
        );
      }

      if (material.scope_type === "personal") {
        if (material.owner_teacher_id !== session.userId) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have permission to delete this material."),
          );
        }
      } else if (material.scope_type === "organization") {
        const { data: membership } = await supabase
          .from("organization_memberships")
          .select("id, role")
          .eq("organization_id", material.owner_organization_id)
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null)
          .maybeSingle();

        if (!membership) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have permission to delete this material."),
          );
        }

        if (membership.role !== "owner" && membership.role !== "manager") {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "Only organization owners or admins can delete organization materials."),
          );
        }
      }

      const timestamp = new Date().toISOString();
      const { data: deletedMaterial, error: deleteError } = await supabase
        .from("materials")
        .update({
          deleted_at: timestamp,
          updated_at: timestamp,
        })
        .eq("id", materialId)
        .is("deleted_at", null)
        .select("id")
        .single();

      if (deleteError || !deletedMaterial) {
        console.error("[teacher/materials/[materialId]] Delete error:", deleteError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to delete material."),
        );
      }

      return toResponse(
        successResponse({
          materialId: deletedMaterial.id,
          message: "Material deleted successfully.",
        }),
      );
    } catch (err) {
      console.error("[teacher/materials/[materialId]] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to delete material."),
      );
    }
  },
  { requiredRole: "teacher" },
);
