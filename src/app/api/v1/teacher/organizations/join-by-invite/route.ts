/**
 * POST /api/v1/teacher/organizations/join-by-invite — Join an organization using an invite token.
 *
 * Validates the invite token and creates an organization membership.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const joinSchema = z.object({
  inviteToken: z.string().min(1).max(255),
});

export const POST = withAuth(
  async (request, _context, { session }) => {
    try {
      const body = await request.json();
      const validation = joinSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid invite token.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { inviteToken } = validation.data;
      const supabase = createServerClient();

      // Find valid invite
      const { data: invite, error: inviteError } = await supabase
        .from("organization_invites")
        .select("id, organization_id, email, role, status, expires_at")
        .eq("token", inviteToken)
        .eq("status", "pending")
        .is("deleted_at", null)
        .maybeSingle();

      if (inviteError) {
        console.error("[teacher/join-by-invite] Invite query error:", inviteError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to validate invite token."),
        );
      }

      if (!invite) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Invalid or expired invite token."),
        );
      }

      // Validate that the logged-in user's email matches the invite email
      if (invite.email !== session.loginIdentifier) {
        return toResponse(
          errorResponse(
            ErrorCodes.FORBIDDEN,
            "This invite was sent to a different email address.",
          ),
        );
      }

      // Check if invite is expired
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        // Mark invite as expired
        await supabase
          .from("organization_invites")
          .update({ status: "expired" })
          .eq("id", invite.id);

        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Invite token has expired."),
        );
      }

      // Check if user is already a member
      const { data: existingMembership, error: membershipCheckError } = await supabase
        .from("organization_memberships")
        .select("id, status")
        .eq("organization_id", invite.organization_id)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (membershipCheckError) {
        console.error("[teacher/join-by-invite] Membership check error:", membershipCheckError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to check existing membership."),
        );
      }

      if (existingMembership) {
        if (existingMembership.status === "active") {
          return toResponse(
            errorResponse(ErrorCodes.CONFLICT, "You are already a member of this organization."),
          );
        }
        // If pending or other status, we could update - for now treat as conflict
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "You have a pending membership in this organization."),
        );
      }

      // Get organization details
      const { data: organization, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug, status")
        .eq("id", invite.organization_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (orgError || !organization) {
        console.error("[teacher/join-by-invite] Organization query error:", orgError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch organization details."),
        );
      }

      // Create membership
      const { data: membership, error: createError } = await supabase
        .from("organization_memberships")
        .insert({
          organization_id: invite.organization_id,
          platform_user_id: session.userId,
          role: invite.role || "teacher",
          status: "active",
        })
        .select("id, role, status, joined_at")
        .single();

      if (createError || !membership) {
        console.error("[teacher/join-by-invite] Membership creation error:", createError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create membership."),
        );
      }

      // Mark invite as accepted
      await supabase
        .from("organization_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);

      return toResponse(
        successResponse({
          membershipId: membership.id,
          organizationId: organization.id,
          organizationName: organization.name,
          organizationSlug: organization.slug,
          role: membership.role,
          status: membership.status,
          joinedAt: membership.joined_at,
        }),
        201,
      );
    } catch (err) {
      console.error("[teacher/join-by-invite] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to join organization."),
      );
    }
  },
  { requiredRole: "teacher" },
);
