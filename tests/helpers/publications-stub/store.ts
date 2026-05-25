import { publicationsBootstrapState } from "./bootstrap-data";
import type { PublicationsState } from "./types";

const PUBLICATIONS_STORE_KEY = "__platformArchitecturePublicationsStore";

function cloneState(state: PublicationsState): PublicationsState {
  return {
    publications: state.publications.map((publication) => ({
      ...publication,
      linkedMaterialIds: [...publication.linkedMaterialIds],
      linkedTestIds: [...publication.linkedTestIds],
    })),
    publicationClasses: state.publicationClasses.map((publicationClass) => ({ ...publicationClass })),
  };
}

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    [PUBLICATIONS_STORE_KEY]?: PublicationsState;
  };

  if (!globalStore[PUBLICATIONS_STORE_KEY]) {
    globalStore[PUBLICATIONS_STORE_KEY] = cloneState(publicationsBootstrapState);
  }

  return globalStore;
}

export function getPublicationsState() {
  return getStore()[PUBLICATIONS_STORE_KEY] as PublicationsState;
}

export function resetPublicationsState() {
  getStore()[PUBLICATIONS_STORE_KEY] = cloneState(publicationsBootstrapState);
}
