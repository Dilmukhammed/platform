/**
 * Auto-scoring utility for test questions.
 * Handles multiple_choice (auto-scored) and short_answer (manual scoring required).
 */

export interface QuestionResult {
  questionId: string;
  questionType: "multiple_choice" | "short_answer";
  score: number | null;
  isCorrect: boolean | null;
  autoScored: boolean;
}

export interface TestQuestion {
  id: string;
  questionType: "multiple_choice" | "short_answer";
  answerJson: { correctIndex?: number; text?: string } | null;
  optionsJson: unknown; // needed to determine option count for shuffle
}

export interface AutoScoreParams {
  testQuestions: TestQuestion[];
  responsesJson: Record<string, string>;
  testId: string;
  shuffleOptions: boolean;
  studentId: string;
}

// Simple seeded random number generator (for deterministic shuffle)
// MUST match the implementation in student/tests/[testId]/route.ts exactly
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return hash / 0x7fffffff;
  };
}

// Fisher-Yates shuffle with seed
// MUST match the implementation in student/tests/[testId]/route.ts exactly
function shuffleWithSeed<T>(array: T[], seed: string): T[] {
  const result = [...array];
  const rng = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Returns the number of options in a question's optionsJson.
 * Handles: null, string arrays, object arrays, and { variants: [...] } objects.
 */
function getOptionCount(optionsJson: unknown): number {
  if (optionsJson == null) return 0;
  if (Array.isArray(optionsJson)) return optionsJson.length;
  if (typeof optionsJson === "object") {
    const obj = optionsJson as Record<string, unknown>;
    if (Array.isArray(obj.variants)) return obj.variants.length;
  }
  return 0;
}

export interface AutoScoreResult {
  questionResults: QuestionResult[];
  scoreRaw: number;
}

/**
 * Auto-scores a test by comparing student responses against correct answers.
 *
 * - multiple_choice: Compares response to "option-N" format (1-based), scores 0 or 1
 * - short_answer: Returns null score (requires manual grading)
 * - Missing response: score 0, isCorrect false, autoScored true
 * - Malformed answer_json: score 0, isCorrect false, autoScored true (skips gracefully)
 *
 * @param params.testQuestions - Array of test questions with answerJson
 * @param params.responsesJson - Map of questionId -> student response ("option-N" for MC)
 * @param params.testId - Test ID (for reference, not used in scoring)
 * @returns questionResults array and scoreRaw (sum of non-null scores)
 */
export function autoScoreTest(params: AutoScoreParams): AutoScoreResult {
  const { testQuestions, responsesJson, shuffleOptions, studentId, testId } = params;

  const questionResults: QuestionResult[] = [];
  let scoreRaw = 0;

  for (const question of testQuestions) {
    const questionId = question.id;
    const studentResponse = responsesJson[questionId];
    const questionType = question.questionType;

    // Handle short_answer - cannot auto-score
    if (questionType === "short_answer") {
      questionResults.push({
        questionId,
        questionType: "short_answer",
        score: null,
        isCorrect: null,
        autoScored: false,
      });
      continue;
    }

    // Handle multiple_choice
    if (questionType === "multiple_choice") {
      // Missing response - score 0, autoScored true
      if (studentResponse === undefined || studentResponse === null || studentResponse === "") {
        questionResults.push({
          questionId,
          questionType: "multiple_choice",
          score: 0,
          isCorrect: false,
          autoScored: true,
        });
        scoreRaw += 0;
        continue;
      }

      // Validate answerJson structure
      const answerJson = question.answerJson;
      if (
        answerJson === null ||
        answerJson === undefined ||
        typeof answerJson !== "object" ||
        typeof answerJson.correctIndex !== "number"
      ) {
        // Malformed answer_json - skip gracefully, score 0
        questionResults.push({
          questionId,
          questionType: "multiple_choice",
          score: 0,
          isCorrect: false,
          autoScored: true,
        });
        scoreRaw += 0;
        continue;
      }

      // Compare student response with correct answer
      // correctIndex is 0-based, student response is 1-based "option-N"
      let isCorrect: boolean;

      if (shuffleOptions) {
        // When options are shuffled, the student's "option-N" refers to position N-1
        // in the SHUFFLED array. We must reverse-map to the original index.
        const optionCount = getOptionCount(question.optionsJson);

        if (optionCount > 0) {
          // Reproduce the same shuffle the student saw
          const originalIndices = Array.from({ length: optionCount }, (_, i) => i);
          const shuffledIndices = shuffleWithSeed(
            originalIndices,
            `${studentId}-${testId}-${questionId}`,
          );

          // Extract the position from "option-N" (1-based → 0-based)
          const match = studentResponse.match(/^option-(\d+)$/);
          if (match) {
            const shuffledPosition = parseInt(match[1], 10) - 1;
            if (shuffledPosition >= 0 && shuffledPosition < shuffledIndices.length) {
              const originalIndex = shuffledIndices[shuffledPosition];
              isCorrect = originalIndex === answerJson.correctIndex;
            } else {
              isCorrect = false;
            }
          } else {
            isCorrect = false;
          }
        } else {
          // No options — fall back to direct comparison
          const correctOptionId = `option-${answerJson.correctIndex + 1}`;
          isCorrect = studentResponse === correctOptionId;
        }
      } else {
        // No shuffle — direct comparison
        const correctOptionId = `option-${answerJson.correctIndex + 1}`;
        isCorrect = studentResponse === correctOptionId;
      }

      questionResults.push({
        questionId,
        questionType: "multiple_choice",
        score: isCorrect ? 1 : 0,
        isCorrect,
        autoScored: true,
      });

      scoreRaw += isCorrect ? 1 : 0;
    }
  }

  return { questionResults, scoreRaw };
}