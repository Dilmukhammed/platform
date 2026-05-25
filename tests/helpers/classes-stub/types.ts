export type ClassStatus = "active";

export type ClassRecord = {
  id: string;
  organizationId: string;
  teacherId: string;
  name: string;
  slug: string;
  description: string | null;
  status: ClassStatus;
  createdAt: string;
  updatedAt: string;
};

export type ClassEnrollmentRecord = {
  id: string;
  classId: string;
  studentId: string;
  studentDisplayName: string;
  studentLogin: string;
  joinedAt: string;
  enrollmentSource: "seeded" | "manual" | "bulk_import" | "self_join";
};

export type ClassesState = {
  classes: ClassRecord[];
  enrollments: ClassEnrollmentRecord[];
};

export type TeacherClassSummary = {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  slug: string;
  description: string | null;
  status: ClassStatus;
  rosterCount: number;
  activeJoinCode: string;
  updatedAt: string;
};

export type ClassRosterStudent = ClassEnrollmentRecord;

export type TeacherClassDetail = TeacherClassSummary & {
  createdAt: string;
  roster: ClassRosterStudent[];
};
