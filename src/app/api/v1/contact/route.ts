/**
 * POST /api/v1/contact — Contact form submission endpoint.
 *
 * Handles contact form submissions:
 * 1. Validates request body (firstName, lastName, email, subject, message)
 * 2. Logs submission for development/admin review
 * 3. Returns success/error feedback to user
 */

import { z } from "zod/v4";

import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";

const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("Please enter a valid email address."),
  subject: z.string().min(1, "Subject is required."),
  message: z.string().min(10, "Message must be at least 10 characters."),
  privacyAgreed: z.boolean().refine((val) => val === true, {
    message: "You must agree to the Privacy Policy.",
  }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

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

    const { firstName, lastName, email, subject, message } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();

    // Log submission for development/admin review
    // In production, this could:
    // - Insert into a contact_submissions table
    // - Send email via configured email service
    // - Create admin notification
    if (process.env.NODE_ENV === "development") {
      console.log("[contact] New form submission from:", fullName);
    }

    return toResponse(
      successResponse({
        message: "Thank you for your message! We'll get back to you soon.",
        submission: {
          name: fullName,
          email: normalizedEmail,
          subject,
          receivedAt: new Date().toISOString(),
        },
      }),
      200,
    );
  } catch (error) {
    console.error("[contact] Unexpected error:", error);
    return toResponse(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to process your message. Please try again later."),
    );
  }
}
