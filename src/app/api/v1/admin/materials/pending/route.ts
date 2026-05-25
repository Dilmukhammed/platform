/**
 * GET /api/v1/admin/materials/pending — List pending material approvals for admin review.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient, getAuthUserEmails } from "@/lib/supabase/server-client";

export const GET = withAuth(
  async () => {
    try {
      const supabase = createServerClient();

      // Get auth user emails (cross-schema join doesn't work via JS client)
      const authEmails = await getAuthUserEmails();

      // Query pending material approvals with related data
      const { data: approvals, error } = await supabase
        .from("material_approvals")
        .select(
          `
          id,
          material_id,
          organization_id,
          created_at,
          materials!inner(
            id,
            title,
            description,
            source_file_path,
            owner_organization_id
          ),
          platform_users!material_approvals_requested_by_platform_user_id_fkey(
            id,
            auth_user_id,
            display_name
          )
        `
        )
        .eq("decision", "pending")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[admin/materials/pending] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch pending materials."),
        );
      }

      // Get target organization names from material_approvals.organization_id
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

      // Transform to response format expected by the page
      const formattedApprovals = (approvals ?? []).map((approval) => {
        // Supabase may return joined data as an object or single-element array depending on relationship.
        // Normalize to a single object for property access.
        const rawMaterial = approval.materials;
        const material = (Array.isArray(rawMaterial) ? rawMaterial[0] : rawMaterial) as Record<string, unknown> | null;
        const rawRequester = approval.platform_users;
        const requester = (Array.isArray(rawRequester) ? rawRequester[0] : rawRequester) as Record<string, unknown> | null;

        const targetOrgId = approval.organization_id as string | null;
        const orgName = targetOrgId
          ? (targetOrganizations[targetOrgId] ?? "Unknown Organization")
          : "Unknown Organization";

        return {
          approvalId: approval.id,
          materialId: approval.material_id,
          title: material?.title ?? "Untitled",
          description: material?.description ?? null,
          sourceFilePath: material?.source_file_path ?? null,
          organizationName: orgName,
          requestedByTeacherName: requester?.display_name ?? "Unknown",
          requestedByTeacherEmail: requester?.auth_user_id
            ? (authEmails.get(requester.auth_user_id as string) ?? "Unknown")
            : "Unknown",
          submittedAt: approval.created_at,
        };
      });

      return toResponse(successResponse(formattedApprovals));
    } catch (err) {
      console.error("[admin/materials/pending] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch pending materials."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
