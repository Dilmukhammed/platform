export const authModule = {
  scope: "auth",
  status: "bootstrap-ready",
} as const;

export * from "./types";
export * from "./bootstrap-data";
export * from "./service";
