export type AssignmentTemplateRecord = {
  id: string;
  teacherId: string;
  organizationId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  linkedMaterialIds: string[];
  linkedTestIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type AssignmentMaterialOption = {
  id: string;
  title: string;
  description: string | null;
  organizationId: string;
  organizationName: string;
  source: "personal" | "school";
  ownerTeacherName: string;
};

export type AssignmentTestOption = {
  id: string;
  title: string;
  description: string | null;
  organizationId: string;
  organizationName: string;
  source: "personal" | "school";
  ownerTeacherName: string;
  questionCount: number;
};

export type AssignmentTemplateSummary = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  organizationId: string;
  organizationName: string;
  linkedMaterialCount: number;
  linkedTestCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AssignmentTemplateDetail = AssignmentTemplateSummary & {
  linkedMaterials: AssignmentMaterialOption[];
  linkedTests: AssignmentTestOption[];
};

export type AssignmentTemplateCreateOptions = {
  organizationId: string;
  organizationName: string;
  materials: AssignmentMaterialOption[];
  tests: AssignmentTestOption[];
};

export type AssignmentsState = {
  templates: AssignmentTemplateRecord[];
};
