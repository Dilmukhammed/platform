import { z } from "zod/v4";

// =============================================================================
// Types
// =============================================================================

export interface BankQuestion {
  questionId: string;
  questionType: string;
  prompt: string;
  optionsJson: Record<string, unknown> | null;
  answerJson: Record<string, unknown>;
  explanation: string | null;
  images: string[];
  scopeType: "personal" | "organization";
  ownerTeacherId: string;
  ownerOrganizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BankQuestionSummary {
  questionId: string;
  questionType: string;
  prompt: string;
  scopeType: "personal" | "organization";
  images: string[];
  createdAt: Date;
}

// =============================================================================
// Zod Schemas
// =============================================================================

/**
 * Base schema for question bank questions (used for both create and update)
 */
const bankQuestionBaseSchema = z.object({
  questionType: z.string().min(1),
  prompt: z.string().min(1).max(5000),
  optionsJson: z.record(z.string(), z.unknown()).nullable().optional(),
  answerJson: z.record(z.string(), z.unknown()),
  explanation: z.string().max(5000).nullable().optional(),
  images: z.array(z.string()).optional().default([]),
  scopeType: z.enum(["personal", "organization"]),
});

/**
 * Schema for creating a new bank question
 * - answerJson is required (NOT NULL in DB)
 * - For multiple_choice, optionsJson.variants must have at least 2 entries
 */
export const createBankQuestionSchema = bankQuestionBaseSchema
  .extend({
    questionType: z.literal("multiple_choice"),
    optionsJson: z.record(z.string(), z.unknown()).nullable(),
  })
  .refine(
    (data) => {
      const variants = data.optionsJson?.variants;
      return Array.isArray(variants) && variants.length >= 2;
    },
    {
      message: "Multiple choice questions must have at least 2 variants",
      path: ["optionsJson"],
    }
  )
  .or(
    bankQuestionBaseSchema.extend({
      questionType: z.literal("short_answer"),
      optionsJson: z.record(z.string(), z.unknown()).nullable().optional(),
    })
  )
  .or(
    bankQuestionBaseSchema.extend({
      questionType: z.string().min(1),
    }).refine(
      (data) => {
        // For any other question type, optionsJson is optional
        return true;
      },
      { message: "Invalid question type" }
    )
  );

/**
 * Schema for updating an existing bank question
 * - All fields are optional
 * - Maintains same validation rules for multiple_choice
 */
export const updateBankQuestionSchema = bankQuestionBaseSchema
  .partial()
  .extend({
    questionType: z.string().min(1).optional(),
    optionsJson: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine(
    (data) => {
      // If questionType is being updated to multiple_choice, validate variants
      if (data.questionType === "multiple_choice" && data.optionsJson) {
        const variants = data.optionsJson.variants;
        return Array.isArray(variants) && variants.length >= 2;
      }
      // If questionType is already multiple_choice and optionsJson is provided
      if (data.optionsJson) {
        const variants = data.optionsJson.variants;
        return Array.isArray(variants) && variants.length >= 2;
      }
      return true;
    },
    {
      message: "Multiple choice questions must have at least 2 variants",
      path: ["optionsJson"],
    }
  );

// =============================================================================
// Inferred Types
// =============================================================================

export type CreateBankQuestionInput = z.infer<typeof createBankQuestionSchema>;
export type UpdateBankQuestionInput = z.infer<typeof updateBankQuestionSchema>;