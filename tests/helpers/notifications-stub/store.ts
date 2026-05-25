import { initialNotificationsData } from "./bootstrap-data";
import type { NotificationsState } from "./types";

const STORE_KEY = "__platformArchitectureNotificationsStore";

function cloneState(state: NotificationsState): NotificationsState {
  return {
    notifications: state.notifications.map((record) => ({
      ...record,
      payload: { ...record.payload },
    })),
  };
}

function getStore() {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: NotificationsState };
  if (!g[STORE_KEY]) g[STORE_KEY] = cloneState({ notifications: initialNotificationsData });
  return g;
}

export function getNotificationsState() {
  return getStore()[STORE_KEY] as NotificationsState;
}

export function resetNotificationsState() {
  getStore()[STORE_KEY] = cloneState({ notifications: initialNotificationsData });
}
