export type PublicationRecord = {
  id: string;
  templateId: string;
  teacherId: string;
  organizationId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  linkedMaterialIds: string[];
  linkedTestIds: string[];
  defaultDeadline: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicationClassRecord = {
  id: string;
  publicationId: string;
  classId: string;
  deadlineOverride: string | null;
  createdAt: string;
};

export type PublicationClassSummary = {
  classId: string;
  className: string;
  classSlug: string;
  rosterCount: number;
  defaultDeadline: string;
  deadlineOverride: string | null;
  effectiveDeadline: string;
};

export type TeacherPublicationSummary = {
  id: string;
  templateId: string;
  title: string;
  organizationId: string;
  organizationName: string;
  defaultDeadline: string;
  classCount: number;
  linkedMaterialCount: number;
  linkedTestCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TeacherPublicationDetail = TeacherPublicationSummary & {
  description: string | null;
  instructions: string | null;
  linkedMaterials: Array<{
    id: string;
    title: string;
    description: string | null;
    organizationName: string;
    source: "personal" | "school";
    ownerTeacherName: string;
  }>;
  linkedTests: Array<{
    id: string;
    title: string;
    description: string | null;
    organizationName: string;
    source: "personal" | "school";
    ownerTeacherName: string;
    questionCount: number;
  }>;
  classTargets: PublicationClassSummary[];
};

export type PublicationsState = {
  publications: PublicationRecord[];
  publicationClasses: PublicationClassRecord[];
};
