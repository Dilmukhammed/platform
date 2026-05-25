import { initialReviewsData } from "./bootstrap-data";
import type { ReviewsState } from "./types";

const REVIEWS_STORE_KEY = "__platformArchitectureReviewsStore";

function cloneState(state: ReviewsState): ReviewsState {
  return {
    reviews: state.reviews.map((record) => ({ ...record })),
  };
}

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    [REVIEWS_STORE_KEY]?: ReviewsState;
  };

  if (!globalStore[REVIEWS_STORE_KEY]) {
    globalStore[REVIEWS_STORE_KEY] = cloneState({ reviews: initialReviewsData });
  }

  return globalStore;
}

export function getReviewsState() {
  return getStore()[REVIEWS_STORE_KEY] as ReviewsState;
}

export function resetReviewsState() {
  getStore()[REVIEWS_STORE_KEY] = cloneState({ reviews: initialReviewsData });
}

