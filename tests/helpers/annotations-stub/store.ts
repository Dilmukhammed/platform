import { initialAnnotationsData } from "./bootstrap-data";
import type { AnnotationsState } from "./types";

const ANNOTATIONS_STORE_KEY = "__platformArchitectureAnnotationsStore";

function cloneState(state: AnnotationsState): AnnotationsState {
  return {
    annotations: state.annotations.map((record) => ({ ...record })),
  };
}

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    [ANNOTATIONS_STORE_KEY]?: AnnotationsState;
  };

  if (!globalStore[ANNOTATIONS_STORE_KEY]) {
    globalStore[ANNOTATIONS_STORE_KEY] = cloneState({ annotations: initialAnnotationsData });
  }

  return globalStore;
}

export function getAnnotationsState() {
  return getStore()[ANNOTATIONS_STORE_KEY] as AnnotationsState;
}

export function resetAnnotationsState() {
  getStore()[ANNOTATIONS_STORE_KEY] = cloneState({ annotations: initialAnnotationsData });
}

