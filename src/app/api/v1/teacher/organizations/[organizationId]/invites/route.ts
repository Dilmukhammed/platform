/**
 * POST /api/v1/teacher/organizations/[organizationId]/invites — Create an organization invite.
 *
 * Only organization owners can invite teachers. Generates a unique token
 * and stores the invite in organization_invites for the accept flow.
 */

import { z } from "zod/v4";
import { randomUUID } from "crypto";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const createInviteSchema = z.object({
  email: z.string().email("Invalid email address."),
  role: z.enum(["teacher", "owner"]).default("teacher"),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const { organizationId } = await context.params;
      const body = await request.json();
      const validation = createInviteSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid invite data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { email, role, expiresAt } = validation.data;
      const supabase = createServerClient();

      // Verify caller is an owner of this organization
      const { data: membership, error: membershipError } = await supabase
        .from("organization_memberships")
        .select("id, role, status")
        .eq("platform_user_id", session.userId)
        .eq("organization_id", organizationId)
        .eq("role", "owner")
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();

      if (membershipError) {
        console.error("[org/invites] Membership check error:", membershipError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify organization membership."),
        );
      }

      if (!membership) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Only organization owners can invite teachers."),
        );
      }

      // Verify organization exists and is active
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug, status")
        .eq("id", organizationId)
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();

      if (orgError) {
        console.error("[org/invites] Organization check error:", orgError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify organization."),
        );
      }

      if (!org) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Organization not found or not active."),
        );
      }

      // Check if there's already a pending invite for this email
      const { data: existingInvite, error: existingInviteError } = await supabase
        .from("organization_invites")
        .select("id, status")
        .eq("organization_id", organizationId)
        .eq("email", email)
        .in("status", ["pending"])
        .is("deleted_at", null)
        .maybeSingle();

      if (existingInviteError) {
        console.error("[org/invites] Existing invite check error:", existingInviteError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to check existing invites."),
        );
      }

      if (existingInvite) {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "An invite has already been sent to this email address."),
        );
      }

      // Check if the user is already a member
      const { data: existingMember } = await supabase
        .from("organization_memberships")
        .select("id, status")
        .eq("organization_id", organizationId)
        .eq("email", email)
        .is("deleted_at", null)
        .maybeSingle();

      // Also check by platform_users email
      if (!existingMember) {
        const { data: userByEmail } = await supabase
          .from("platform_users")
          .select("id")
          .eq("login_identifier", email)
          .maybeSingle();

        if (userByEmail) {
          const { data: membershipByUser } = await supabase
            .from("organization_memberships")
            .select("id, status")
            .eq("organization_id", organizationId)
            .eq("platform_user_id", userByEmail.id)
            .is("deleted_at", null)
            .maybeSingle();

          if (membershipByUser) {
            return toResponse(
              errorResponse(ErrorCodes.CONFLICT, "This user is already a member of the organization."),
            );
          }
        }
      } else {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "This user is already a member of the organization."),
        );
      }

      // Generate invite token and create invite
      const token = randomUUID();
      const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      const { data: invite, error: createError } = await supabase
        .from("organization_invites")
        .insert({
          organization_id: organizationId,
          token,
          email,
          role,
          status: "pending",
          invited_by_platform_user_id: session.userId,
          expires_at: expiresAt ?? defaultExpiry,
        })
        .select("id, token, email, role, status, expires_at, created_at")
        .single();

      if (createError) {
        console.error("[org/invites] Create error:", createError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create invite."),
        );
      }

      return toResponse(
        successResponse({
          inviteId: invite.id,
          token: invite.token,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expires_at,
          createdAt: invite.created_at,
          organizationName: org.name,
          inviteLink: `/auth/teacher/invite/accept?token=${token}`,
        }),
        201,
      );
    } catch (err) {
      console.error("[org/invites] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create invite."),
      );
    }
  },
  { requiredRole: "teacher" },
);
