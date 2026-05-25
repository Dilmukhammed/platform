if (process.env.NODE_ENV === "production") {
  throw new Error("join-codes/store.ts is a legacy in-memory module — use class_join_codes table instead");
}

import { joinCodesBootstrapState } from "./bootstrap-data";
import type { JoinCodesState } from "./types";

const JOIN_CODES_STORE_KEY = "__platformArchitectureJoinCodesStore";

function cloneState(state: JoinCodesState): JoinCodesState {
  return {
    records: state.records.map((record) => ({ ...record })),
  };
}

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    [JOIN_CODES_STORE_KEY]?: JoinCodesState;
  };

  if (!globalStore[JOIN_CODES_STORE_KEY]) {
    globalStore[JOIN_CODES_STORE_KEY] = cloneState(joinCodesBootstrapState);
  }

  return globalStore;
}

export function getJoinCodesState() {
  return getStore()[JOIN_CODES_STORE_KEY] as JoinCodesState;
}

export function resetJoinCodesState() {
  getStore()[JOIN_CODES_STORE_KEY] = cloneState(joinCodesBootstrapState);
}
