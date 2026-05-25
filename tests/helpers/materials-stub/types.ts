export type MaterialStatus = "personal" | "pending_school" | "approved_school" | "rejected_school";

export type MaterialRecord = {
  id: string;
  teacherId: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: MaterialStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedByAdminId: string | null;
  rejectedAt: string | null;
  rejectedByAdminId: string | null;
  rejectionReason: string | null;
};

export type TeacherMaterialSummary = {
  id: string;
  title: string;
  description: string | null;
  organizationId: string;
  organizationName: string;
  status: MaterialStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  canSubmitToSchool: boolean;
  visibleInSchoolLibrary: boolean;
};

export type PendingSchoolMaterialApproval = {
  materialId: string;
  title: string;
  description: string | null;
  organizationId: string;
  organizationName: string;
  requestedByTeacherId: string;
  requestedByTeacherName: string;
  requestedByTeacherEmail: string;
  submittedAt: string;
};

export type SchoolLibraryMaterial = {
  materialId: string;
  title: string;
  description: string | null;
  organizationId: string;
  organizationName: string;
  ownerTeacherId: string;
  ownerTeacherName: string;
  approvedAt: string;
};

export type MaterialsState = {
  materials: MaterialRecord[];
};
