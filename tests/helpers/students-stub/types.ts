export type StudentProfileStatus = "active" | "blocked" | "archived";

export type StudentCredentialStatus = "active" | "blocked" | "archived";

export type OrganizationStudentStatus = "active";

export type StudentProvisioningSource = "manual" | "bulk_import" | "self_join";

export type StudentProfileRecord = {
  id: string;
  studentLogin: string;
  firstName: string;
  lastName: string;
  displayName: string;
  status: StudentProfileStatus;
  createdAt: string;
  updatedAt: string;
};

export type StudentCredentialRecord = {
  id: string;
  studentId: string;
  pinHash: string;
  status: StudentCredentialStatus;
  lastPinChangedAt: string;
};

export type OrganizationStudentRecord = {
  id: string;
  organizationId: string;
  studentId: string;
  status: OrganizationStudentStatus;
  joinedAt: string;
};

export type BulkImportRowStatus = "created" | "attached_existing" | "duplicate" | "error";

export type BulkImportRowResult = {
  lineNumber: number;
  studentLogin: string;
  classCode: string;
  status: BulkImportRowStatus;
  message: string;
};

export type BulkImportResult = {
  importedAt: string;
  totalRows: number;
  createdCount: number;
  attachedExistingCount: number;
  duplicateCount: number;
  errorCount: number;
  rows: BulkImportRowResult[];
};

export type StudentsState = {
  profiles: StudentProfileRecord[];
  credentials: StudentCredentialRecord[];
  organizationStudents: OrganizationStudentRecord[];
  latestBulkImportReport: BulkImportResult | null;
};

export type StudentAuthLookup = {
  id: string;
  studentLogin: string;
  displayName: string;
  pinHash: string;
  status: StudentCredentialStatus;
};

export type ProvisionedStudentSummary = {
  id: string;
  studentLogin: string;
  firstName: string;
  lastName: string;
  displayName: string;
  classCount: number;
  classes: Array<{
    classId: string;
    className: string;
    joinedAt: string;
    source: string;
  }>;
  createdAt: string;
};

export type ManualStudentCreateResult = {
  studentId: string;
  studentLogin: string;
  displayName: string;
  /** The PIN assigned to this student — returned once at creation time for the teacher */
  assignedPin: string;
  classId: string;
  className: string;
  organizationName: string;
};

export type SelfJoinResult = {
  result: "attached_existing" | "already_enrolled" | "created_new";
  studentId: string;
  studentLogin: string;
  displayName: string;
  classId: string;
  className: string;
  organizationName: string;
};
