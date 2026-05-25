/**
 * GET /api/v1/admin/material-approvals — List material approval requests.
 */

import { withAuth } from "@/lib/api/with-auth";
import { paginatedResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient, getAuthUserEmails } from "@/lib/supabase/server-client";

export const GET = withAuth(
  async (request) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);
      const status = searchParams.get("status") || "pending";

      const supabase = createServerClient();

      // Get auth user emails (cross-schema join doesn't work via JS client)
      const authEmails = await getAuthUserEmails();

      let query = supabase
        .from("material_approvals")
        .select(
          `
          id,
          material_id,
          organization_id,
          decision,
          requested_by_platform_user_id,
          reviewed_by_platform_user_id,
          decision_reason,
          reviewed_at,
          created_at,
          updated_at,
          materials!inner(
            id,
            title,
            description,
            scope_type,
            owner_teacher_id,
            owner_organization_id,
            status
          ),
          platform_users!material_approvals_requested_by_platform_user_id_fkey(
            id,
            auth_user_id,
            display_name
          )
        `,
          { count: "exact" },
        )
        .is("deleted_at", null);

      // Filter by decision status if provided
      if (status && status !== "all") {
        query = query.eq("decision", status);
      }

      const { data: approvals, error, count } = await query
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[admin/material-approvals] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch material approvals."),
        );
      }

      // Fetch target organization names from material_approvals.organization_id
      const targetOrgIds = (approvals ?? [])
        .map((a) => a.organization_id as string | null)
        .filter((id): id is string => id !== null);

      let targetOrganizations: Record<string, string> = {};
      if (targetOrgIds.length > 0) {
        const uniqueOrgIds = [...new Set(targetOrgIds)];
        const { data: orgs, error: orgError } = await supabase
          .from("organizations")
          .select("id, name")
          .in("id", uniqueOrgIds);

        if (!orgError && orgs) {
          targetOrganizations = Object.fromEntries(
            orgs.map((org) => [org.id, org.name])
          );
        }
      }

      // Transform to response format
      const formattedApprovals = (approvals ?? []).map((approval) => {
        // Supabase may return joined data as an object or single-element array depending on relationship.
        // Normalize to a single object for property access.
        const rawMaterial = approval.materials;
        const material = (Array.isArray(rawMaterial) ? rawMaterial[0] : rawMaterial) as Record<string, unknown> | null;
        const rawRequester = approval.platform_users;
        const requester = (Array.isArray(rawRequester) ? rawRequester[0] : rawRequester) as Record<string, unknown> | null;

        const targetOrgId = approval.organization_id as string | null;
        const targetOrgName = targetOrgId
          ? (targetOrganizations[targetOrgId] ?? "Unknown Organization")
          : "Unknown Organization";

        return {
          approvalId: approval.id,
          materialId: approval.material_id,
          title: material?.title,
          description: material?.description,
          scopeType: material?.scope_type,
          ownerTeacherId: material?.owner_teacher_id,
          ownerOrganizationId: material?.owner_organization_id,
          targetOrganizationId: targetOrgId,
          targetOrganizationName: targetOrgName,
          materialStatus: material?.status,
          decision: approval.decision,
          requestedBy: requester
            ? {
                userId: requester.id,
                email: requester.auth_user_id ? (authEmails.get(requester.auth_user_id as string) ?? null) : null,
                displayName: requester.display_name,
              }
            : null,
          requestedAt: approval.created_at,
          reviewedBy: approval.reviewed_by_platform_user_id,
          reviewedAt: approval.reviewed_at,
          rejectionReason: approval.decision_reason,
          createdAt: approval.created_at,
          updatedAt: approval.updated_at,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(formattedApprovals, paginationMeta));
    } catch (err) {
      console.error("[admin/material-approvals] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch material approvals."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
