import { classesBootstrapState } from "./bootstrap-data";
import type { ClassesState } from "./types";

const CLASSES_STORE_KEY = "__platformArchitectureClassesStore";

function cloneState(state: ClassesState): ClassesState {
  return {
    classes: state.classes.map((record) => ({ ...record })),
    enrollments: state.enrollments.map((record) => ({ ...record })),
  };
}

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    [CLASSES_STORE_KEY]?: ClassesState;
  };

  if (!globalStore[CLASSES_STORE_KEY]) {
    globalStore[CLASSES_STORE_KEY] = cloneState(classesBootstrapState);
  }

  return globalStore;
}

export function getClassesState() {
  return getStore()[CLASSES_STORE_KEY] as ClassesState;
}

export function resetClassesState() {
  getStore()[CLASSES_STORE_KEY] = cloneState(classesBootstrapState);
}
