if (process.env.NODE_ENV === "production") {
  throw new Error("grades/store.ts is a legacy in-memory module — use grades/actions.ts instead");
}

import { initialGradesData } from "./bootstrap-data";
import type { GradesState } from "./types";

const GRADES_STORE_KEY = "__platformArchitectureGradesStore";

function cloneState(state: GradesState): GradesState {
  return {
    grades: state.grades.map((record) => ({
      ...record,
      formulaSnapshot: { ...record.formulaSnapshot },
    })),
  };
}

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    [GRADES_STORE_KEY]?: GradesState;
  };

  if (!globalStore[GRADES_STORE_KEY]) {
    globalStore[GRADES_STORE_KEY] = cloneState({ grades: initialGradesData });
  }

  return globalStore;
}

export function getGradesState() {
  return getStore()[GRADES_STORE_KEY] as GradesState;
}

export function resetGradesState() {
  getStore()[GRADES_STORE_KEY] = cloneState({ grades: initialGradesData });
}
