import { t } from "@/lib/translations";
import type {
  AiTestDraftInput,
  AiTestDraftOutput,
  AiGeneratedQuestion,
  DeterministicTestDraftInput,
  DeterministicGeneratedTestDraft,
} from "./types";

// ── AI Provider configuration ──
// Priority: MINIMAX_API_KEY (direct) > FIREWORKS_API_KEY (gateway) > deterministic stub

const MINIMAX_BASE_URL = "https://api.minimax.io/v1";
const FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1";

const MINIMAX_MODEL = process.env.MINIMAX_MODEL ?? "MiniMax-M2.7";
const FIREWORKS_MODEL = process.env.FIREWORKS_MODEL ?? "accounts/fireworks/models/minimax-m2p7";

type AiProvider = "minimax" | "fireworks";

function selectProvider(): { provider: AiProvider; apiKey: string; baseUrl: string; model: string } {
  if (process.env.MINIMAX_API_KEY) {
    return {
      provider: "minimax",
      apiKey: process.env.MINIMAX_API_KEY,
      baseUrl: MINIMAX_BASE_URL,
      model: MINIMAX_MODEL,
    };
  }
  if (process.env.FIREWORKS_API_KEY) {
    return {
      provider: "fireworks",
      apiKey: process.env.FIREWORKS_API_KEY,
      baseUrl: FIREWORKS_BASE_URL,
      model: FIREWORKS_MODEL,
    };
  }
  return { provider: "minimax", apiKey: "", baseUrl: MINIMAX_BASE_URL, model: MINIMAX_MODEL };
}

function buildSystemPrompt(input: AiTestDraftInput): string {
  const questionTypeLabel =
    input.questionType === "multiple_choice"
      ? "multiple choice (4 options each with one correct answer)"
      : "short answer";

  return `You are a professional test creator for an educational platform. Generate a test draft based on the teacher's prompt.

RULES:
- Generate exactly ${input.questionCount} questions of type "${questionTypeLabel}".
- Difficulty level: ${input.difficulty}.
- Organization context: ${input.organizationName}.
- Each question must be educationally sound and test real understanding.
- Explanations should help the teacher understand the intended answer.
- For multiple choice: provide exactly 4 options, mark one as correct.
- For short answer: provide a concise model answer.
- All content must be appropriate for educational use.
- Respond ONLY with valid JSON, no markdown fences or extra text.`;
}

function buildUserPrompt(input: AiTestDraftInput): string {
  return input.prompt;
}

function buildResponseSchema(questionCount: number, questionType: string) {
  if (questionType === "multiple_choice") {
    return {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              questionType: { type: "string", const: "multiple_choice" },
              prompt: { type: "string" },
              options: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    isCorrect: { type: "boolean" },
                  },
                  required: ["text", "isCorrect"],
                },
                minItems: 4,
                maxItems: 4,
              },
              answer: { type: "string" },
              explanation: { type: "string" },
            },
            required: ["questionType", "prompt", "options", "answer", "explanation"],
          },
          minItems: questionCount,
          maxItems: questionCount,
        },
      },
      required: ["title", "description", "questions"],
    };
  }

  return {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            questionType: { type: "string", const: "short_answer" },
            prompt: { type: "string" },
            answer: { type: "string" },
            explanation: { type: "string" },
          },
          required: ["questionType", "prompt", "answer", "explanation"],
        },
        minItems: questionCount,
        maxItems: questionCount,
      },
    },
    required: ["title", "description", "questions"],
  };
}

/**
 * Generate an AI test draft using MiniMax direct API or Fireworks AI as fallback.
 */
export async function generateAiTestDraft(input: AiTestDraftInput): Promise<AiTestDraftOutput> {
  const { provider, apiKey, baseUrl, model } = selectProvider();

  if (!apiKey) {
    console.warn("[ai/service] No AI API key set, falling back to deterministic stub.");
    return generateDeterministicTestDraft(input);
  }

  const prompt = input.prompt.trim();
  if (prompt.length < 8) {
    throw new Error(t.api.ai.draftPromptMin);
  }

  const responseSchema = buildResponseSchema(input.questionCount, input.questionType);

  // MiniMax M2.7 does NOT support response_format:json_schema — it ignores it and returns
  // plain text. Fireworks DOES support json_schema natively.
  // Strategy:
  //   - Fireworks: use native json_schema (model constrained by schema)
  //   - MiniMax: use json_object + embed schema in system prompt text
  const isFireworks = provider === "fireworks";

  const systemPrompt = isFireworks
    ? buildSystemPrompt(input)
    : `${buildSystemPrompt(input)}

OUTPUT FORMAT — respond with a single JSON object following this exact schema:
${JSON.stringify(responseSchema, null, 2)}`;

  const responseFormat = isFireworks
    ? {
        type: "json_schema" as const,
        json_schema: { name: "test_draft", schema: responseSchema },
      }
    : { type: "json_object" as const };

  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildUserPrompt(input) },
    ],
    max_tokens: 4096,
    temperature: 0.7,
    response_format: responseFormat,
  };

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      console.error(`[ai/service] ${provider} API error:`, response.status, errorText);
      throw new Error(t.api.ai.generationFailed.replace("{status}", String(response.status)));
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(t.api.ai.emptyResponse);
    }

    // MiniMax wraps reasoning in <think>...</think> tags — strip them before JSON parse
    const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    const parsed = JSON.parse(cleanContent);

    // Validate and normalize
    const questions: AiGeneratedQuestion[] = parsed.questions.map((q: Record<string, unknown>) => {
      if (q.questionType === "multiple_choice" && Array.isArray(q.options)) {
        // Ensure exactly one correct option
        const options = (q.options as Array<Record<string, unknown>>).map((o) => ({
          text: String(o.text),
          isCorrect: Boolean(o.isCorrect),
        }));

        // If no option is marked correct, mark the first one
        if (!options.some((o) => o.isCorrect)) {
          options[0].isCorrect = true;
        }
        // If multiple are marked correct, keep only the first
        let foundCorrect = false;
        const normalizedOptions = options.map((o) => {
          if (o.isCorrect && foundCorrect) return { ...o, isCorrect: false };
          if (o.isCorrect) foundCorrect = true;
          return o;
        });

        const correctOption = normalizedOptions.find((o) => o.isCorrect);
        return {
          questionType: "multiple_choice" as const,
          prompt: String(q.prompt),
          options: normalizedOptions,
          answer: correctOption?.text ?? "",
          explanation: String(q.explanation ?? ""),
        };
      }

      return {
        questionType: "short_answer" as const,
        prompt: String(q.prompt),
        answer: String(q.answer),
        explanation: String(q.explanation ?? ""),
      };
    });

    return {
      title: String(parsed.title),
      description: String(parsed.description),
      prompt,
      providerLabel: `${provider}-${model}`,
      questions,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error("[ai/service] Failed to parse AI JSON response:", error);
      throw new Error(t.api.ai.invalidJson);
    }
    throw error;
  }
}

// ── Deterministic fallback (used when no API key is configured) ──

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toWords(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function pickTopic(words: string[], index: number) {
  if (words.length === 0) {
    return `drawing principle ${index + 1}`;
  }
  return words[index % words.length];
}

export function generateDeterministicTestDraft(input: DeterministicTestDraftInput): DeterministicGeneratedTestDraft {
  const prompt = normalizeText(input.prompt);

  if (prompt.length < 8) {
    throw new Error(t.api.ai.draftPromptMin);
  }

  const questionCount = Math.min(5, Math.max(3, Math.round(input.questionCount)));
  const words = toWords(prompt);
  const primaryTopic = toTitleCase(pickTopic(words, 0));
  const secondaryTopic = toTitleCase(pickTopic(words, 1));
  const questionType = input.questionType ?? "short_answer";

  return {
    title: `${primaryTopic} Draft Checkpoint`,
    description: `Deterministic AI draft for ${input.organizationName}: covers ${primaryTopic} and ${secondaryTopic}. Teachers must edit and validate before any school submission.`,
    prompt,
    providerLabel: "deterministic-local-stub",
    questions: Array.from({ length: questionCount }, (_, index) => {
      const topic = toTitleCase(pickTopic(words, index));
      const answer = `${topic} should follow the classroom drafting standard, keep line work readable, and match the stated projection goal.`;
      const explanation = `Deterministic AI stub draft note: teachers should review ${topic} for local terminology, examples, and scoring expectations before submission.`;

      if (questionType === "multiple_choice") {
        return {
          questionType,
          prompt: `Question ${index + 1}: Which statement best describes how ${topic} should be applied in a ${input.organizationName} drafting task?`,
          options: [
            { text: answer, isCorrect: true },
            { text: `${topic} should be ignored if the drawing already looks complete.`, isCorrect: false },
            { text: `${topic} only matters after grading is finished.`, isCorrect: false },
            { text: `${topic} should be replaced with any informal classroom preference.`, isCorrect: false },
          ],
          answer,
          explanation,
        };
      }

      return {
        questionType,
        prompt: `Question ${index + 1}: How should ${topic} be applied in a ${input.organizationName} drafting task?`,
        answer,
        explanation,
      };
    }),
  };
}
