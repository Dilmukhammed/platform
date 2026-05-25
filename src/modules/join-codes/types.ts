export type JoinCodeStatus = "active" | "rotated";

export type JoinCodeRecord = {
  id: string;
  classId: string;
  code: string;
  status: JoinCodeStatus;
  createdAt: string;
  createdByTeacherId: string;
  rotatedAt: string | null;
  rotatedByTeacherId: string | null;
};

export type JoinCodeHistoryEntry = JoinCodeRecord;

export type JoinCodesState = {
  records: JoinCodeRecord[];
};
