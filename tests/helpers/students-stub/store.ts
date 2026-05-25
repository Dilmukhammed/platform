import { studentsBootstrapState } from "./bootstrap-data";
import type { StudentsState } from "./types";

const STUDENTS_STORE_KEY = "__platformArchitectureStudentsStore";

function cloneState(state: StudentsState): StudentsState {
  return {
    profiles: state.profiles.map((record) => ({ ...record })),
    credentials: state.credentials.map((record) => ({ ...record })),
    organizationStudents: state.organizationStudents.map((record) => ({ ...record })),
    latestBulkImportReport: state.latestBulkImportReport
      ? {
          ...state.latestBulkImportReport,
          rows: state.latestBulkImportReport.rows.map((row) => ({ ...row })),
        }
      : null,
  };
}

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    [STUDENTS_STORE_KEY]?: StudentsState;
  };

  if (!globalStore[STUDENTS_STORE_KEY]) {
    globalStore[STUDENTS_STORE_KEY] = cloneState(studentsBootstrapState);
  }

  return globalStore;
}

export function getStudentsState() {
  return getStore()[STUDENTS_STORE_KEY] as StudentsState;
}

export function resetStudentsState() {
  getStore()[STUDENTS_STORE_KEY] = cloneState(studentsBootstrapState);
}
