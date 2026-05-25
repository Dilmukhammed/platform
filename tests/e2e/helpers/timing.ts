import * as fs from "fs";
import * as path from "path";

/**
 * Timing entry for QA reporting
 */
export type TimingEntry = {
  flow: string;
  step: string;
  durationMs: number;
  status: "pass" | "fail";
  details?: string;
  timestamp: string;
};

/**
 * Result of a timed action
 */
export type TimedResult<T> = {
  result: T;
  durationMs: number;
};

/**
 * Wraps an async action with timing measurement
 * @param label - Description of the action being timed
 * @param fn - Async function to execute
 * @returns Promise resolving to the result and duration in milliseconds
 */
export async function timedAction<T>(
  label: string,
  fn: () => Promise<T>
): Promise<TimedResult<T>> {
  const startTime = performance.now();
  try {
    const result = await fn();
    const durationMs = performance.now() - startTime;
    return { result, durationMs };
  } catch (error) {
    const durationMs = performance.now() - startTime;
    throw new Error(`Timed action "${label}" failed after ${durationMs.toFixed(2)}ms: ${error}`);
  }
}

/**
 * Writes timing report to the evidence directory
 * @param report - Array of timing entries to write
 */
export function writeTimingReport(report: TimingEntry[]): void {
  const evidenceDir = path.resolve(".sisyphus/evidence/qa");

  // Ensure directory exists
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  const reportPath = path.join(evidenceDir, "full-timing-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
}

/**
 * Creates a timing entry object
 * @param flow - The test flow name
 * @param step - The step within the flow
 * @param durationMs - Duration in milliseconds
 * @param status - Pass or fail status
 * @param details - Optional additional details
 * @returns TimingEntry object
 */
export function createTimingEntry(
  flow: string,
  step: string,
  durationMs: number,
  status: "pass" | "fail",
  details?: string
): TimingEntry {
  return {
    flow,
    step,
    durationMs,
    status,
    details,
    timestamp: new Date().toISOString(),
  };
}