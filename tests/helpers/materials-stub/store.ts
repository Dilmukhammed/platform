import { materialsBootstrapState } from "./bootstrap-data";
import type { MaterialsState } from "./types";

const MATERIALS_STORE_KEY = "__platformArchitectureMaterialsStore";

function cloneState(state: MaterialsState): MaterialsState {
  return {
    materials: state.materials.map((material) => ({ ...material })),
  };
}

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    [MATERIALS_STORE_KEY]?: MaterialsState;
  };

  if (!globalStore[MATERIALS_STORE_KEY]) {
    globalStore[MATERIALS_STORE_KEY] = cloneState(materialsBootstrapState);
  }

  return globalStore;
}

export function getMaterialsState() {
  return getStore()[MATERIALS_STORE_KEY] as MaterialsState;
}

export function resetMaterialsState() {
  getStore()[MATERIALS_STORE_KEY] = cloneState(materialsBootstrapState);
}
