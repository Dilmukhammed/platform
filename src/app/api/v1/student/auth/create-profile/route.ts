/**
 * POST /api/v1/student/auth/create-profile — First-time student profile creation.
 *
 * Creates a student_profile + student_credential in Supabase,
 * then auto-logs in by writing an HMAC-signed auth cookie.
 */

import { randomBytes } from "node:crypto";

import { z } from "zod/v4";

import { writeAuthSession } from "@/lib/auth/session";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";
import { hashPin } from "@/lib/crypto/pin-hash";

const createProfileSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters."),
  lastName: z.string().min(2, "Last name must be at least 2 characters."),
  middleName: z.string().optional(),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 numeric digits."),
});

function buildDisplayName(firstName: string, lastName: string, middleName?: string) {
  const parts = [firstName, middleName, lastName].filter(Boolean);
  return parts.join(" ").trim();
}

function generateStudentLogin(): string {
  // Generate 3 random bytes (24 bits) for a number between 0-16777215
  // Format as 6-digit number with leading zeros if needed
  const buffer = randomBytes(3);
  const num = buffer.readUIntBE(0, 3);
  const paddedNum = num.toString().padStart(6, "0").slice(-6);
  return `ST-${paddedNum}`;
}

async function generateUniqueStudentLogin(supabase: ReturnType<typeof createServerClient>, maxAttempts = 5): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const login = generateStudentLogin();
    
    // Check if login already exists
    const { data: existing } = await supabase
      .from("student_profiles")
      .select("id")
      .eq("student_login", login)
      .is("deleted_at", null)
      .limit(1);
    
    if (!existing || existing.length === 0) {
      return login;
    }
  }
  
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createProfileSchema.safeParse(body);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return toResponse(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid request body.",
          undefined,
          details,
        ),
      );
    }

    const { firstName, lastName, middleName, pin } = parsed.data;
    const displayName = buildDisplayName(firstName, lastName, middleName);
    const pinHash = await hashPin(pin);

    const supabase = createServerClient();

    // Generate a unique student login with collision handling
    const studentLogin = await generateUniqueStudentLogin(supabase);

    if (!studentLogin) {
      return toResponse(
        errorResponse(ErrorCodes.CONFLICT, "Unable to generate unique student login. Please try again."),
      );
    }

    // Insert student_profile
    const { data: profile, error: profileError } = await supabase
      .from("student_profiles")
      .insert({
        student_login: studentLogin,
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName ?? null,
        display_name: displayName,
        status: "active",
      })
      .select("id, student_login, display_name")
      .single();

    if (profileError || !profile) {
      console.error("[create-profile] Error inserting student_profile:", profileError);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create student profile."),
      );
    }

    // Insert student_credential
    const { error: credentialError } = await supabase
      .from("student_credentials")
      .insert({
        student_profile_id: profile.id,
        pin_hash: pinHash,
        status: "active",
      });

    if (credentialError) {
      console.error("[create-profile] Error inserting student_credential:", credentialError);
      // Attempt to clean up the profile
      await supabase.from("student_profiles").delete().eq("id", profile.id);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create student credentials."),
      );
    }

    // Auto-login: write auth session cookie
    const authSession = {
      userId: profile.id,
      role: "student" as const,
      displayName: profile.display_name ?? displayName,
      loginIdentifier: profile.student_login,
    };

    await writeAuthSession(authSession);

    return toResponse(
      successResponse({
        authenticated: true,
        principal: {
          id: profile.id,
          type: "student",
          displayName: authSession.displayName,
        },
        role: "student",
        studentLogin: profile.student_login,
      }),
      201,
    );
  } catch (error) {
    console.error("[create-profile] Unexpected error:", error);
    return toResponse(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Profile creation failed."),
    );
  }
}
