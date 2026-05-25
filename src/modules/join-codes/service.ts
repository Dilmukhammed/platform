if (process.env.NODE_ENV === "production") {
  throw new Error("join-codes/service.ts is a legacy in-memory module — use class_join_codes table instead");
}

import { t } from "@/lib/translations";
import { getJoinCodesState } from "./store";
import type { JoinCodeHistoryEntry, JoinCodeRecord } from "./types";

const JOIN_CODE_PATTERN = /^\d{6}$/;
const FIRST_GENERATED_CODE = 120801;
const LAST_GENERATED_CODE = 999999;
const WRAP_GENERATED_CODE = 100000;

export function isValidJoinCodeFormat(code: string) {
  return JOIN_CODE_PATTERN.test(code);
}

function assertJoinCodeFormat(code: string) {
  if (!isValidJoinCodeFormat(code)) {
    throw new Error(t.api.joinCodes.joinCodeMustBeSixDigits);
  }
}

function nextJoinCodeId(records: JoinCodeRecord[]) {
  return `71000000-0000-4000-8000-${String(records.length + 1).padStart(12, "0")}`;
}

function sortNewestFirst(left: JoinCodeRecord, right: JoinCodeRecord) {
  return right.createdAt.localeCompare(left.createdAt);
}

function generateUniqueJoinCode(records: JoinCodeRecord[]) {
  const usedCodes = new Set(records.map((record) => Number(record.code)));
  const capacity = LAST_GENERATED_CODE - WRAP_GENERATED_CODE + 1;
  let candidate = Math.max(
    FIRST_GENERATED_CODE,
    ...records.map((record) => Number(record.code)).filter((value) => Number.isFinite(value)),
  );

  for (let attempt = 0; attempt < capacity; attempt += 1) {
    candidate = candidate >= LAST_GENERATED_CODE ? WRAP_GENERATED_CODE : candidate + 1;

    if (!usedCodes.has(candidate)) {
      return String(candidate).padStart(6, "0");
    }
  }

  throw new Error(t.api.joinCodes.noJoinCodesAvailable);
}

function ensureSingleActiveCode(records: JoinCodeRecord[], classId: string) {
  const activeCodes = records.filter((record) => record.classId === classId && record.status === "active");

  if (activeCodes.length > 1) {
    throw new Error(t.api.joinCodes.onlyOneActiveJoinCode);
  }

  return activeCodes[0] ?? null;
}

export function getActiveJoinCodeForClass(classId: string) {
  const state = getJoinCodesState();
  const activeCode = ensureSingleActiveCode(state.records, classId);

  if (activeCode) {
    assertJoinCodeFormat(activeCode.code);
  }

  return activeCode;
}

export function listJoinCodeHistoryForClass(classId: string): JoinCodeHistoryEntry[] {
  const state = getJoinCodesState();

  return state.records
    .filter((record) => record.classId === classId)
    .map((record) => {
      assertJoinCodeFormat(record.code);
      return { ...record };
    })
    .sort(sortNewestFirst);
}

export function createInitialJoinCodeForClass(input: { classId: string; teacherId: string; createdAt?: string }) {
  const state = getJoinCodesState();

  if (ensureSingleActiveCode(state.records, input.classId)) {
    throw new Error(t.api.joinCodes.classAlreadyHasActiveJoinCode);
  }

  const code = generateUniqueJoinCode(state.records);
  assertJoinCodeFormat(code);

  const record: JoinCodeRecord = {
    id: nextJoinCodeId(state.records),
    classId: input.classId,
    code,
    status: "active",
    createdAt: input.createdAt ?? new Date().toISOString(),
    createdByTeacherId: input.teacherId,
    rotatedAt: null,
    rotatedByTeacherId: null,
  };

  state.records.push(record);
  return { ...record };
}

export function rotateJoinCode(input: { classId: string; teacherId: string }) {
  const state = getJoinCodesState();
  const currentActive = ensureSingleActiveCode(state.records, input.classId);

  if (!currentActive) {
    throw new Error(t.api.joinCodes.classDoesNotHaveActiveJoinCode);
  }

  const rotatedAt = new Date().toISOString();
  currentActive.status = "rotated";
  currentActive.rotatedAt = rotatedAt;
  currentActive.rotatedByTeacherId = input.teacherId;

  const nextCode = createInitialJoinCodeForClass({
    classId: input.classId,
    teacherId: input.teacherId,
    createdAt: rotatedAt,
  });

  return {
    activeCode: nextCode,
    history: listJoinCodeHistoryForClass(input.classId),
  };
}
