/**
 * GET /api/v1/teacher/tests/{testId}/questions/{questionId}/image
 * Returns a 302 redirect to a signed URL for the first question image.
 */

import { withAuth } from "@/lib/api/with-auth";
import { errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

export const GET = withAuth(
  async (_request, context, { session: _session }) => {
    try {
      const params = await context.params;
      const testId = params.testId as string;
      const questionId = params.questionId as string;

      const supabase = createServerClient();

      const { data: question, error } = await supabase
        .from("test_questions")
        .select("id, test_id, images")
        .eq("id", questionId)
        .eq("test_id", testId)
        .single();

      if (error || !question) {
        return toResponse(errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Question not found."));
      }

      const imagePaths = (question.images as string[]) ?? [];
      const firstImage = imagePaths[0];
      if (!firstImage) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "No image for this question."),
        );
      }

      const bucketName = process.env.SUPABASE_UPLOADS_BUCKET
        ?? process.env.NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET
        ?? "uploads";

      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(firstImage, 3600);

      if (urlError || !signedUrlData?.signedUrl) {
        console.error("[teacher/tests/questions/image] Signed URL error:", urlError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to generate image URL."),
        );
      }

      return Response.redirect(signedUrlData.signedUrl, 302);
    } catch (err) {
      console.error("[teacher/tests/questions/image] Unexpected error:", err);
      return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to serve image."));
    }
  },
  { requiredRole: "teacher" },
);
