import { submissionsBootstrapState } from "./bootstrap-data";
import type { SubmissionsState } from "./types";

const SUBMISSIONS_STORE_KEY = "__platformArchitectureSubmissionsStore";

function cloneState(state: SubmissionsState): SubmissionsState {
  return {
    results: state.results.map((record) => ({ ...record, submissionIds: [...record.submissionIds] })),
    submissions: state.submissions.map((record) => ({ ...record, previewAssetIds: [...record.previewAssetIds] })),
    assets: state.assets.map((record) => ({ ...record })),
  };
}

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    [SUBMISSIONS_STORE_KEY]?: SubmissionsState;
  };

  if (!globalStore[SUBMISSIONS_STORE_KEY]) {
    globalStore[SUBMISSIONS_STORE_KEY] = cloneState(submissionsBootstrapState);
  }

  return globalStore;
}

export function getSubmissionsState() {
  return getStore()[SUBMISSIONS_STORE_KEY] as SubmissionsState;
}

export function resetSubmissionsState() {
  getStore()[SUBMISSIONS_STORE_KEY] = cloneState(submissionsBootstrapState);
}
