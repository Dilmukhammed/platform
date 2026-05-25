import { organizationsBootstrapState } from "./bootstrap-data";
import type { OrganizationsState } from "./types";

const ORGANIZATIONS_STORE_KEY = "__platformArchitectureOrganizationsStore";

function cloneState(state: OrganizationsState): OrganizationsState {
  return {
    organizations: state.organizations.map((organization) => ({ ...organization })),
    memberships: state.memberships.map((membership) => ({ ...membership })),
    teacherSelections: { ...state.teacherSelections },
  };
}

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    [ORGANIZATIONS_STORE_KEY]?: OrganizationsState;
  };

  if (!globalStore[ORGANIZATIONS_STORE_KEY]) {
    globalStore[ORGANIZATIONS_STORE_KEY] = cloneState(organizationsBootstrapState);
  }

  return globalStore;
}

export function getOrganizationsState() {
  return getStore()[ORGANIZATIONS_STORE_KEY] as OrganizationsState;
}

export function resetOrganizationsState() {
  getStore()[ORGANIZATIONS_STORE_KEY] = cloneState(organizationsBootstrapState);
}
