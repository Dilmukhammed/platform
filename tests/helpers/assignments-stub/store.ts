import { assignmentsBootstrapState } from "./bootstrap-data";
import type { AssignmentsState } from "./types";

const ASSIGNMENTS_STORE_KEY = "__platformArchitectureAssignmentsStore";

function cloneState(state: AssignmentsState): AssignmentsState {
  return {
    templates: state.templates.map((template) => ({
      ...template,
      linkedMaterialIds: [...template.linkedMaterialIds],
      linkedTestIds: [...template.linkedTestIds],
    })),
  };
}

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    [ASSIGNMENTS_STORE_KEY]?: AssignmentsState;
  };

  if (!globalStore[ASSIGNMENTS_STORE_KEY]) {
    globalStore[ASSIGNMENTS_STORE_KEY] = cloneState(assignmentsBootstrapState);
  }

  return globalStore;
}

export function getAssignmentsState() {
  return getStore()[ASSIGNMENTS_STORE_KEY] as AssignmentsState;
}

export function resetAssignmentsState() {
  getStore()[ASSIGNMENTS_STORE_KEY] = cloneState(assignmentsBootstrapState);
}
