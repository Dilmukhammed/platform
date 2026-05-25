/**
 * GET /api/v1/teacher/materials — List teacher's materials.
 * POST /api/v1/teacher/materials — Create a new material.
 */

import { z } from "zod/v4";
import { cookies } from "next/headers";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";
import { getMaterialSchoolVisibilityStatesForOrganization } from "@/modules/materials/school-visibility";

import { getUploadSessionById, uploadSessionBelongsToUser } from "../../uploads/store";

const SELECTED_ORG_COOKIE = "teacher_selected_org";

type ReviewState = "none" | "pending" | "approved" | "rejected";

function computeReviewState(decision: string | null | undefined): ReviewState {
  if (!decision) return "none";
  if (decision === "pending") return "pending";
  if (decision === "approved") return "approved";
  if (decision === "rejected") return "rejected";
  return "none";
}

const createMaterialSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  scopeType: z.enum(["personal", "organization"]),
  organizationId: z.string().uuid().optional(),
  uploadId: z.string().uuid(),
});

// GET — List materials
export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);
      const scopeFilter = searchParams.get("scopeType"); // optional filter: personal | organization

      const supabase = createServerClient();

      // Resolve selected organization (cookie → first active membership)
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

      // Build base query (no approval join — canonical helper handles that)
      let query = supabase
        .from("materials")
        .select("*", { count: "exact" })
        .is("deleted_at", null);

      // Apply scope-based filtering
      if (scopeFilter === "personal") {
        query = query
          .eq("scope_type", "personal")
          .eq("owner_teacher_id", session.userId);
      } else if (scopeFilter === "organization") {
        // For organization scope, teacher must be a member
        const { data: memberships } = await supabase
          .from("organization_memberships")
          .select("organization_id")
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null);

        const orgIds = (memberships ?? []).map((m) => m.organization_id);
        if (orgIds.length === 0) {
          // No org memberships, return empty
          return toResponse(
            paginatedResponse([], buildPaginationMeta(pagination.page, pagination.pageSize, 0))
          );
        }

        query = query
          .eq("scope_type", "organization")
          .in("owner_organization_id", orgIds);
      } else {
        // No filter: show personal materials + org materials from teacher's orgs
        const { data: memberships } = await supabase
          .from("organization_memberships")
          .select("organization_id")
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null);

        const orgIds = (memberships ?? []).map((m) => m.organization_id);

        query = query.or(
          `and(scope_type.eq.personal,owner_teacher_id.eq.${session.userId}),` +
          `and(scope_type.eq.organization,owner_organization_id.in.(${orgIds.join(",")}))`
        );
      }

      const { data: materials, error, count } = await query
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[teacher/materials] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch materials."),
        );
      }

      // Compute review states using canonical helper
      const materialIds = (materials ?? []).map((m: Record<string, unknown>) => m.id as string);
      const visibilityStates = await getMaterialSchoolVisibilityStatesForOrganization(supabase, {
        materialIds,
        organizationId: selectedOrgId,
      });

      // Batch query decision_reason for non-pending approvals (helper doesn't include it)
      const approvalIds: string[] = [];
      for (const state of visibilityStates.values()) {
        if (state.latestApproval && state.latestApproval.decision !== "pending") {
          approvalIds.push(state.latestApproval.approvalId);
        }
      }

      const decisionReasons = new Map<string, string | null>();
      if (approvalIds.length > 0) {
        const { data: approvals } = await supabase
          .from("material_approvals")
          .select("id, decision_reason")
          .in("id", approvalIds);

        for (const a of approvals ?? []) {
          decisionReasons.set(a.id, a.decision_reason);
        }
      }

      // Transform to response format
      const transformed = (materials ?? []).map((material: Record<string, unknown>) => {
        const state = visibilityStates.get(material.id as string);
        const latestApproval = state?.latestApproval ?? null;
        const reviewState = computeReviewState(latestApproval?.decision);
        const latestDecision = latestApproval && latestApproval.decision !== "pending"
          ? latestApproval.decision
          : null;
        const latestDecisionReason = latestApproval && latestApproval.decision !== "pending"
          ? decisionReasons.get(latestApproval.approvalId) ?? null
          : null;

        return {
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
          schoolVisible: state?.isSchoolVisible ?? false,
          submittedAt: latestApproval?.createdAt ?? null,
          decidedAt: latestApproval && latestApproval.decision !== "pending"
            ? latestApproval.reviewedAt ?? null
            : null,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(transformed, paginationMeta));
    } catch (err) {
      console.error("[teacher/materials] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch materials."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// POST — Create material
export const POST = withAuth(
  async (request, _context, { session }) => {
    try {
      const body = await request.json();
      const validation = createMaterialSchema.safeParse(body);

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

      const { title, description, scopeType, organizationId, uploadId } = validation.data;
      const supabase = createServerClient();

      const upload = await getUploadSessionById(supabase, uploadId);

      if (!upload || !uploadSessionBelongsToUser(upload, session)) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Completed upload not found."),
        );
      }

      if (upload.uploadType !== "material") {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Upload must be a material upload."),
        );
      }

      if (upload.status !== "completed") {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "Upload must be completed before creating a material."),
        );
      }

      // Validate ownership based on scope type
      if (scopeType === "personal") {
        // Personal scope: owner_teacher_id must be the current user
        // organizationId should not be provided
        if (organizationId) {
          return toResponse(
            errorResponse(
              ErrorCodes.VALIDATION_ERROR,
              "Organization ID should not be provided for personal scope materials.",
            ),
          );
        }
      } else if (scopeType === "organization") {
        // Organization scope: teacher must be a member of the org
        if (!organizationId) {
          return toResponse(
            errorResponse(
              ErrorCodes.VALIDATION_ERROR,
              "Organization ID is required for organization scope materials.",
            ),
          );
        }

        const { data: membership, error: membershipError } = await supabase
          .from("organization_memberships")
          .select("id, status")
          .eq("organization_id", organizationId)
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null)
          .maybeSingle();

        if (membershipError) {
          console.error("[teacher/materials] Membership check error:", membershipError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify organization membership."),
          );
        }

        if (!membership || membership.status !== "active") {
          return toResponse(
            errorResponse(
              ErrorCodes.FORBIDDEN,
              "You must be an active member of the organization to create materials in its library.",
            ),
          );
        }
      }

      // Create material
        const insertData: Record<string, unknown> = {
          title,
          description,
          scope_type: scopeType,
          source_file_path: upload.storagePath,
          status: "draft",
        };

      if (scopeType === "personal") {
        insertData.owner_teacher_id = session.userId;
      } else {
        insertData.owner_organization_id = organizationId;
      }

      const { data: material, error: createError } = await supabase
        .from("materials")
        .insert(insertData)
        .select("id, title, description, scope_type, owner_teacher_id, owner_organization_id, status, source_file_path, created_at, updated_at")
        .single();

      if (createError || !material) {
        console.error("[teacher/materials] Create error:", createError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create material."),
        );
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
        }),
        201,
      );
    } catch (err) {
      console.error("[teacher/materials] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create material."),
      );
    }
  },
  { requiredRole: "teacher" },
);
