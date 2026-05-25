import { cache } from "react";
import { cookies } from "next/headers";

import { createServerClient } from "@/lib/supabase/server-client";
import { getMaterialSchoolVisibilityStatesForOrganization } from "@/modules/materials/school-visibility";

const SELECTED_ORG_COOKIE = "teacher_selected_org";
const PAGE_SIZE = 20;

type ReviewState = "none" | "pending" | "approved" | "rejected";

export type TeacherSelectedOrganization = {
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
};

export type TeacherOnboardingState = "active" | "pending_approval" | "no_org";

export type TeacherOrganizationMembershipSummary = {
  membershipId: string;
  organizationId: string;
  name: string;
  slug: string;
  status: string;
  role: string;
  membershipStatus: string;
  joinedAt: string;
  createdAt: string;
};

export type TeacherClassSummary = {
  classTeacherId: string;
  classId: string;
  title: string;
  description: string | null;
  status: string;
  organizationId: string;
  role: string;
  isPrimary: boolean;
  createdAt: string;
};

export type TeacherClassDetail = {
  classId: string;
  title: string;
  description: string | null;
  status: string;
  organization: {
    organizationId: string;
    name: string;
    slug: string;
  } | null;
  teacherRole: string;
  isPrimary: boolean;
  studentCount: number;
  joinCode: {
    joinCodeId: string;
    code: string;
    status: string;
    validFrom: string;
    validUntil: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type TeacherClassRosterStudentSummary = {
  enrollmentId: string;
  studentProfileId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  displayName: string | null;
  studentLogin: string;
  studentStatus: string;
  enrollmentStatus: string;
  joinedAt: string;
  leftAt: string | null;
  source: "seeded" | "manual" | "bulk_import" | "self_join";
};

export type TeacherStudentEnrollmentSummary = {
  enrollmentId: string;
  studentProfileId: string;
  studentLogin: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  displayName: string;
  studentStatus: string;
  enrollmentStatus: string;
  classId: string;
  className: string;
  joinedAt: string;
  leftAt: string | null;
  source: string;
};

export type TeacherAssignmentTemplateSummary = {
  templateId: string;
  title: string;
  description: string | null;
  hasPractice: boolean;
  hasTest: boolean;
  linkedTestId: string | null;
  gradingSchemeOverrideId: string | null;
  status: string;
  materialCount: number;
  materialIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type TeacherAssignmentTemplateDetail = {
  templateId: string;
  title: string;
  description: string | null;
  hasPractice: boolean;
  hasTest: boolean;
  materialIds: string[];
  linkedTestId: string | null;
  materials: Array<{ materialId: string; title: string }>;
  linkedTest: { testId: string; title: string } | null;
  status: string;
  teacherId: string;
  createdAt: string;
  updatedAt: string;
};

export type TeacherAssignmentTemplateCreateOptions = {
  organizationId: string;
  organizationName: string | null;
  materials: Array<{ id: string; title: string }>;
  tests: Array<{ id: string; title: string }>;
};

export type TeacherMaterialSummary = {
  materialId: string;
  title: string;
  description: string | null;
  scopeType: string;
  ownerTeacherId: string | null;
  ownerOrganizationId: string | null;
  status: string;
  sourceFilePath: string | null;
  createdAt: string;
  updatedAt: string;
  reviewState: ReviewState;
  latestDecision: string | null;
  latestDecisionReason: string | null;
  schoolVisible: boolean;
  submittedAt: string | null;
  decidedAt: string | null;
};

export type TeacherPublicationSummary = {
  id: string;
  templateId: string;
  title: string | null;
  description: string | null;
  defaultDeadline: string | null;
  classCount: number;
  linkedMaterialCount: number;
  linkedTestCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  organizationName: string | null;
};

export type TeacherPendingReviewSummary = {
  assignmentResultId: string;
  status: string;
  practiceSubmittedAt: string | null;
  testSubmittedAt: string | null;
  hasLinkedTest: boolean;
  student: {
    studentProfileId: string | null;
    displayName: string | null;
    studentLogin: string | null;
  };
  class: {
    classId: string | null;
    title: string | null;
  };
  assignment: {
    publicationId: string | null;
    templateId: string | null;
    title: string | null;
  };
  review: {
    reviewId: string;
    status: string;
    reviewedByTeacherId: string | null;
    createdAt: string;
  } | null;
  isPending: boolean;
};

export type TeacherNotificationSummary = {
  notificationId: string;
  recipientType: string;
  recipientPlatformUserId: string;
  type: string;
  payloadJson: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type TeacherTestSummary = {
  testId: string;
  title: string;
  description: string | null;
  scopeType: string;
  ownerTeacherId: string | null;
  ownerOrganizationId: string | null;
  status: "draft" | "active" | "archived" | "deletion_requested";
  origin: "manual" | "ai_stub" | "ai_draft" | "imported";
  linkedTestId: string | null;
  sourceFilePath: string | null;
  questionCount: number;
  totalPoints: number | null;
  createdAt: string;
  updatedAt: string;
  pendingApproval: {
    approvalId: string;
    decision: string | null;
    requestedAt: string;
  } | null;
};

export type TeacherSchoolLibraryTestSummary = {
  testId: string;
  title: string;
  description: string | null;
  ownerTeacherName: string | null;
  questionCount: number;
  approvedAt: string | null;
};

export type TeacherAssignmentPublicationSummary = {
  publicationId: string;
  templateId: string;
  templateTitle: string | null;
  hasPractice: boolean;
  hasTest: boolean;
  publishedByTeacherId: string;
  defaultDeadline: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  classCount: number;
  classTargets: Array<{
    publicationClassId: string;
    classId: string;
    deadlineOverride: string | null;
    effectiveDeadline: string | null;
    status: string;
  }>;
};

type TeacherOrganizationContext = {
  selected: TeacherSelectedOrganization;
  activeOrganizationId: string | null;
  allOrganizationIds: string[];
  hasPendingMembership: boolean;
};

function computeReviewState(decision: string | null | undefined): ReviewState {
  if (!decision) return "none";
  if (decision === "pending") return "pending";
  if (decision === "approved") return "approved";
  if (decision === "rejected") return "rejected";
  return "none";
}

const getTeacherOrganizationContext = cache(async (userId: string): Promise<TeacherOrganizationContext> => {
  const cookieStore = await cookies();
  const selectedOrgId = cookieStore.get(SELECTED_ORG_COOKIE)?.value ?? null;
  const supabase = createServerClient();

  const [{ data: activeMemberships, error: activeMembershipsError }, { data: allMemberships, error: allMembershipsError }] =
    await Promise.all([
      supabase
        .from("organization_memberships")
        .select("organization_id, joined_at, organizations!inner(id, name, slug)")
        .eq("platform_user_id", userId)
        .eq("status", "active")
        .is("deleted_at", null)
        .is("organizations.deleted_at", null)
        .order("joined_at", { ascending: true }),
      supabase
        .from("organization_memberships")
        .select("organization_id, status")
        .eq("platform_user_id", userId)
        .is("deleted_at", null),
    ]);

  if (activeMembershipsError) {
    throw activeMembershipsError;
  }

  if (allMembershipsError) {
    throw allMembershipsError;
  }

  const activeRows = activeMemberships ?? [];
  const relevantMemberships = (allMemberships ?? []).filter((membership) => {
    const status = membership.status as string | null | undefined;
    return status === "active" || status === "pending";
  });
  const allOrganizationIds = Array.from(
    new Set(relevantMemberships.map((membership) => membership.organization_id as string)),
  );
  const hasPendingMembership = relevantMemberships.some((membership) => membership.status === "pending");

  if (activeRows.length === 0) {
    return {
      selected: {
        organizationId: null,
        organizationName: null,
        organizationSlug: null,
      },
      activeOrganizationId: null,
      allOrganizationIds,
      hasPendingMembership,
    };
  }

  const matchingMembership =
    activeRows.find((membership) => membership.organization_id === selectedOrgId) ?? activeRows[0];
  const organization = matchingMembership.organizations as unknown as
    | { id: string; name: string; slug: string }
    | null;

  return {
    selected: {
      organizationId: organization?.id ?? matchingMembership.organization_id,
      organizationName: organization?.name ?? null,
      organizationSlug: organization?.slug ?? null,
    },
    activeOrganizationId: organization?.id ?? matchingMembership.organization_id,
    allOrganizationIds,
    hasPendingMembership,
  };
});

export async function getTeacherSelectedOrganization(userId: string): Promise<TeacherSelectedOrganization> {
  const context = await getTeacherOrganizationContext(userId);
  return context.selected;
}

export async function getTeacherOnboardingState(userId: string): Promise<TeacherOnboardingState> {
  const context = await getTeacherOrganizationContext(userId);

  if (context.allOrganizationIds.length === 0) {
    return "no_org";
  }

  if (context.hasPendingMembership) {
    return "pending_approval";
  }

  return "active";
}

export async function listTeacherOrganizations(
  userId: string,
  options?: { pageSize?: number },
): Promise<TeacherOrganizationMembershipSummary[]> {
  const supabase = createServerClient();
  const pageSize = options?.pageSize ?? PAGE_SIZE;

  const { data, error } = await supabase
    .from("organization_memberships")
    .select(
      `
      id,
      role,
      status,
      joined_at,
      organizations!inner(
        id,
        name,
        slug,
        status,
        created_at
      )
    `,
    )
    .eq("platform_user_id", userId)
    .is("deleted_at", null)
    .is("organizations.deleted_at", null)
    .order("joined_at", { ascending: false })
    .range(0, pageSize - 1);

  if (error) {
    throw error;
  }

  return (data ?? []).map((membership: Record<string, unknown>) => {
    const orgValue = membership.organizations as unknown;
    const organization = (Array.isArray(orgValue) ? orgValue[0] : orgValue) as
      | Record<string, unknown>
      | null;

    return {
      membershipId: membership.id as string,
      organizationId: (organization?.id as string) ?? "",
      name: (organization?.name as string) ?? "",
      slug: (organization?.slug as string) ?? "",
      status: (organization?.status as string) ?? "",
      role: (membership.role as string) ?? "",
      membershipStatus: (membership.status as string) ?? "",
      joinedAt: (membership.joined_at as string) ?? "",
      createdAt: (organization?.created_at as string) ?? "",
    };
  });
}

export async function listTeacherClasses(
  userId: string,
  options?: { organizationId?: string | null; classStatus?: string | null; pageSize?: number },
): Promise<TeacherClassSummary[]> {
  const supabase = createServerClient();
  const pageSize = options?.pageSize ?? PAGE_SIZE;

  let query = supabase
    .from("class_teachers")
    .select(
      `
      id,
      role,
      is_primary,
      status,
      classes!inner(
        id,
        title,
        description,
        status,
        organization_id,
        created_at
      )
    `,
    )
    .eq("platform_user_id", userId)
    .is("deleted_at", null)
    .is("classes.deleted_at", null)
    .eq("status", "active");

  if (options?.organizationId) {
    query = query.eq("classes.organization_id", options.organizationId);
  }

  if (options?.classStatus) {
    query = query.eq("classes.status", options.classStatus);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false, referencedTable: "classes" })
    .range(0, pageSize - 1);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const classData = row.classes as Record<string, unknown> | null;
    return {
      classTeacherId: row.id as string,
      classId: classData?.id as string,
      title: (classData?.title as string) ?? "",
      description: (classData?.description as string | null) ?? null,
      status: (classData?.status as string) ?? "active",
      organizationId: (classData?.organization_id as string) ?? "",
      role: (row.role as string) ?? "",
      isPrimary: Boolean(row.is_primary),
      createdAt: (classData?.created_at as string) ?? "",
    };
  });
}

export async function getTeacherClassDetail(
  userId: string,
  classId: string,
): Promise<TeacherClassDetail | null> {
  const supabase = createServerClient();

  const { data: classTeacher, error: teacherError } = await supabase
    .from("class_teachers")
    .select("id, role, is_primary, status")
    .eq("class_id", classId)
    .eq("platform_user_id", userId)
    .is("deleted_at", null)
    .eq("status", "active")
    .maybeSingle();

  if (teacherError) {
    throw teacherError;
  }

  if (!classTeacher) {
    return null;
  }

  const [{ data: classData, error: classError }, { data: joinCode, error: joinCodeError }, { count: studentCount, error: countError }] =
    await Promise.all([
      supabase
        .from("classes")
        .select("id, title, description, status, organization_id, created_at, updated_at")
        .eq("id", classId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("class_join_codes")
        .select("id, code, status, valid_from, valid_until")
        .eq("class_id", classId)
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("class_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("class_id", classId)
        .eq("status", "active")
        .is("deleted_at", null),
    ]);

  if (classError) {
    throw classError;
  }

  if (joinCodeError) {
    throw joinCodeError;
  }

  if (countError) {
    throw countError;
  }

  if (!classData) {
    return null;
  }

  let organization: { organizationId: string; name: string; slug: string } | null = null;
  if (classData.organization_id) {
    const { data: organizationData, error: organizationError } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("id", classData.organization_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (organizationError) {
      throw organizationError;
    }

    organization = organizationData
      ? {
          organizationId: organizationData.id as string,
          name: (organizationData.name as string) ?? "",
          slug: (organizationData.slug as string) ?? "",
        }
      : null;
  }

  return {
    classId: classData.id as string,
    title: (classData.title as string) ?? "",
    description: (classData.description as string | null) ?? null,
    status: (classData.status as string) ?? "",
    organization,
    teacherRole: (classTeacher.role as string) ?? "",
    isPrimary: Boolean(classTeacher.is_primary),
    studentCount: studentCount ?? 0,
    joinCode: joinCode
      ? {
          joinCodeId: joinCode.id as string,
          code: (joinCode.code as string) ?? "",
          status: (joinCode.status as string) ?? "",
          validFrom: (joinCode.valid_from as string) ?? "",
          validUntil: (joinCode.valid_until as string | null) ?? null,
        }
      : null,
    createdAt: (classData.created_at as string) ?? "",
    updatedAt: (classData.updated_at as string) ?? "",
  };
}

export async function listTeacherClassStudents(
  userId: string,
  classId: string,
  options?: { status?: string | null; pageSize?: number },
): Promise<TeacherClassRosterStudentSummary[]> {
  const supabase = createServerClient();
  const pageSize = options?.pageSize ?? PAGE_SIZE;

  const { data: classTeacher, error: teacherError } = await supabase
    .from("class_teachers")
    .select("id")
    .eq("class_id", classId)
    .eq("platform_user_id", userId)
    .is("deleted_at", null)
    .eq("status", "active")
    .maybeSingle();

  if (teacherError) {
    throw teacherError;
  }

  if (!classTeacher) {
    return [];
  }

  let query = supabase
    .from("class_enrollments")
    .select(
      `
      id,
      status,
      joined_at,
      left_at,
      source,
      student_profiles!inner(
        id,
        student_login,
        first_name,
        last_name,
        middle_name,
        display_name,
        status
      )
    `,
    )
    .eq("class_id", classId)
    .is("deleted_at", null);

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query
    .order("joined_at", { ascending: false })
    .range(0, pageSize - 1);

  if (error) {
    throw error;
  }

  return (data ?? []).map((enrollment: Record<string, unknown>) => {
    const profileValue = enrollment.student_profiles as unknown;
    const profile = (Array.isArray(profileValue) ? profileValue[0] : profileValue) as Record<string, unknown> | null;

    return {
      enrollmentId: enrollment.id as string,
      studentProfileId: (profile?.id as string) ?? "",
      studentLogin: (profile?.student_login as string) ?? "",
      firstName: (profile?.first_name as string) ?? "",
      lastName: (profile?.last_name as string) ?? "",
      middleName: (profile?.middle_name as string | null) ?? null,
      displayName: (profile?.display_name as string | null) ?? null,
      studentStatus: (profile?.status as string) ?? "",
      enrollmentStatus: (enrollment.status as string) ?? "",
      joinedAt: (enrollment.joined_at as string) ?? "",
      leftAt: (enrollment.left_at as string | null) ?? null,
      source: ((enrollment.source as TeacherClassRosterStudentSummary["source"]) ?? "manual"),
    };
  });
}

export async function listTeacherStudents(
  userId: string,
  options?: { page?: number; pageSize?: number },
): Promise<{ students: TeacherStudentEnrollmentSummary[]; total: number }> {
  const { activeOrganizationId } = await getTeacherOrganizationContext(userId);
  if (!activeOrganizationId) {
    return { students: [], total: 0 };
  }

  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const supabase = createServerClient();
  const { data, error, count } = await supabase
    .from("class_enrollments")
    .select(
      `
      id,
      status,
      joined_at,
      left_at,
      source,
      class_id,
      student_profiles!inner(
        id,
        student_login,
        first_name,
        last_name,
        middle_name,
        display_name,
        status
      ),
      classes!inner(
        id,
        title,
        organization_id
      )
    `,
      { count: "exact" },
    )
    .eq("organization_id", activeOrganizationId)
    .is("deleted_at", null)
    .eq("status", "active")
    .order("joined_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw error;
  }

  const total = count ?? 0;

  const students = (data ?? []).map((enrollment: Record<string, unknown>) => {
    const profile = enrollment.student_profiles as Record<string, unknown> | null;
    const classInfo = enrollment.classes as Record<string, unknown> | null;
    return {
      enrollmentId: enrollment.id as string,
      studentProfileId: (profile?.id as string) ?? "",
      studentLogin: (profile?.student_login as string) ?? "",
      firstName: (profile?.first_name as string) ?? "",
      lastName: (profile?.last_name as string) ?? "",
      middleName: (profile?.middle_name as string | null) ?? null,
      displayName: (profile?.display_name as string) ?? "",
      studentStatus: (profile?.status as string) ?? "",
      enrollmentStatus: (enrollment.status as string) ?? "",
      classId: (enrollment.class_id as string) ?? "",
      className: (classInfo?.title as string) ?? "",
      joinedAt: (enrollment.joined_at as string) ?? "",
      leftAt: (enrollment.left_at as string | null) ?? null,
      source: (enrollment.source as string) ?? "",
    };
  });

  return { students, total };
}

export async function listTeacherAssignmentTemplates(
  userId: string,
  options?: { status?: string | null; pageSize?: number; page?: number },
): Promise<{ templates: TeacherAssignmentTemplateSummary[]; total: number }> {
  const supabase = createServerClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("assignment_templates")
    .select("*, assignment_template_materials!left(*)", { count: "exact" })
    .eq("teacher_id", userId)
    .is("deleted_at", null);

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw error;
  }

  const total = count ?? 0;

  return {
    templates: (data ?? []).map((template: Record<string, unknown>) => {
    const materials = (template.assignment_template_materials as Array<Record<string, unknown>>) ?? [];

    return {
      templateId: template.id as string,
      title: (template.title as string) ?? "",
      description: (template.description as string | null) ?? null,
      hasPractice: Boolean(template.has_practice),
      hasTest: Boolean(template.has_test),
      linkedTestId: (template.linked_test_id as string | null) ?? null,
      gradingSchemeOverrideId: (template.grading_scheme_override_id as string | null) ?? null,
      status: (template.status as string) ?? "",
      materialCount: materials.length,
      materialIds: materials.map((material) => material.material_id as string),
      createdAt: (template.created_at as string) ?? "",
      updatedAt: (template.updated_at as string) ?? "",
    };
  }),
  total,
  };
}

export async function getTeacherAssignmentTemplateDetail(
  userId: string,
  templateId: string,
): Promise<TeacherAssignmentTemplateDetail | null> {
  const supabase = createServerClient();

  const { data: template, error } = await supabase
    .from("assignment_templates")
    .select("*, assignment_template_materials!left(*)")
    .eq("id", templateId)
    .eq("teacher_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!template) {
    return null;
  }

  const materials = (template.assignment_template_materials as Array<Record<string, unknown>>) ?? [];
  const materialIds = materials.map((material) => material.material_id as string);

  let materialDetails: Array<{ id: string; title: string }> = [];
  if (materialIds.length > 0) {
    const { data: materialData, error: materialsError } = await supabase
      .from("materials")
      .select("id, title")
      .in("id", materialIds)
      .is("deleted_at", null);

    if (materialsError) {
      throw materialsError;
    }

    materialDetails = (materialData ?? []) as Array<{ id: string; title: string }>;
  }

  let linkedTestDetail: { id: string; title: string } | null = null;
  if (template.linked_test_id) {
    const { data: testData, error: testError } = await supabase
      .from("tests")
      .select("id, title")
      .eq("id", template.linked_test_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (testError) {
      throw testError;
    }

    linkedTestDetail = testData as { id: string; title: string } | null;
  }

  return {
    templateId: template.id as string,
    teacherId: (template.teacher_id as string) ?? "",
    title: (template.title as string) ?? "",
    description: (template.description as string | null) ?? null,
    hasPractice: Boolean(template.has_practice),
    hasTest: Boolean(template.has_test),
    linkedTestId: (template.linked_test_id as string | null) ?? null,
    linkedTest: linkedTestDetail
      ? { testId: linkedTestDetail.id, title: linkedTestDetail.title }
      : null,
    status: (template.status as string) ?? "",
    materialIds,
    materials: materialDetails.map((material) => ({
      materialId: material.id,
      title: material.title,
    })),
    createdAt: (template.created_at as string) ?? "",
    updatedAt: (template.updated_at as string) ?? "",
  };
}

export async function getTeacherAssignmentTemplateCreateOptions(
  userId: string,
): Promise<TeacherAssignmentTemplateCreateOptions | null> {
  const { activeOrganizationId, selected } = await getTeacherOrganizationContext(userId);
  if (!activeOrganizationId) {
    return null;
  }

  const supabase = createServerClient();

  const { data: allMaterials, error: materialsError } = await supabase
    .from("materials")
    .select("id, title, scope_type, owner_teacher_id")
    .eq("status", "active")
    .is("deleted_at", null);

  if (materialsError) {
    throw materialsError;
  }

  const materialIds = (allMaterials ?? []).map((material: { id: string }) => material.id);
  const visibilityStates = await getMaterialSchoolVisibilityStatesForOrganization(supabase, {
    materialIds,
    organizationId: activeOrganizationId,
  });

  const eligibleMaterials = ((allMaterials ?? []) as Array<{
    id: string;
    title: string;
    scope_type: string;
    owner_teacher_id: string | null;
  }>).filter((material) => {
    if (material.scope_type === "personal" && material.owner_teacher_id === userId) {
      return true;
    }

    return visibilityStates.get(material.id)?.isSchoolVisible === true;
  });

  const { data: tests, error: testsError } = await supabase
    .from("tests")
    .select("id, title")
    .is("deleted_at", null)
    .eq("status", "active")
    .or(
      `and(scope_type.eq.personal,owner_teacher_id.eq.${userId}),` +
        `and(scope_type.eq.organization,owner_organization_id.eq.${activeOrganizationId})`,
    )
    .order("title", { ascending: true });

  if (testsError) {
    throw testsError;
  }

  return {
    organizationId: activeOrganizationId,
    organizationName: selected.organizationName,
    materials: eligibleMaterials
      .map((material) => ({ id: material.id, title: material.title }))
      .sort((left, right) => left.title.localeCompare(right.title)),
    tests: (tests ?? []).map((test: Record<string, unknown>) => ({
      id: test.id as string,
      title: (test.title as string) ?? "",
    })),
  };
}

export async function listTeacherMaterials(
  userId: string,
  options?: { scopeType?: "personal" | "organization" | null; pageSize?: number; page?: number },
): Promise<{ materials: TeacherMaterialSummary[]; total: number }> {
  const { activeOrganizationId, allOrganizationIds } = await getTeacherOrganizationContext(userId);
  const supabase = createServerClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("materials")
    .select("*", { count: "exact" })
    .is("deleted_at", null);

  if (options?.scopeType === "personal") {
    query = query.eq("scope_type", "personal").eq("owner_teacher_id", userId);
  } else if (options?.scopeType === "organization") {
    if (allOrganizationIds.length === 0) {
      return { materials: [], total: 0 };
    }

    query = query.eq("scope_type", "organization").in("owner_organization_id", allOrganizationIds);
  } else if (allOrganizationIds.length > 0) {
    query = query.or(
      `and(scope_type.eq.personal,owner_teacher_id.eq.${userId}),` +
        `and(scope_type.eq.organization,owner_organization_id.in.(${allOrganizationIds.join(",")}))`,
    );
  } else {
    query = query.eq("scope_type", "personal").eq("owner_teacher_id", userId);
  }

  const { data: materials, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw error;
  }

  const materialIds = (materials ?? []).map((material: Record<string, unknown>) => material.id as string);
  const visibilityStates = await getMaterialSchoolVisibilityStatesForOrganization(supabase, {
    materialIds,
    organizationId: activeOrganizationId,
  });

  const approvalIds = Array.from(visibilityStates.values())
    .map((state) => state.latestApproval)
    .filter((approval): approval is NonNullable<typeof approval> => Boolean(approval && approval.decision !== "pending"))
    .map((approval) => approval.approvalId);

  const decisionReasons = new Map<string, string | null>();
  if (approvalIds.length > 0) {
    const { data: approvals, error: approvalsError } = await supabase
      .from("material_approvals")
      .select("id, decision_reason")
      .in("id", approvalIds);

    if (approvalsError) {
      throw approvalsError;
    }

    for (const approval of approvals ?? []) {
      decisionReasons.set(approval.id as string, (approval.decision_reason as string | null) ?? null);
    }
  }

  const total = count ?? 0;

  return {
    materials: (materials ?? []).map((material: Record<string, unknown>) => {
    const state = visibilityStates.get(material.id as string);
    const latestApproval = state?.latestApproval ?? null;
    const latestDecision =
      latestApproval && latestApproval.decision !== "pending" ? latestApproval.decision : null;

    return {
      materialId: material.id as string,
      title: (material.title as string) ?? "",
      description: (material.description as string | null) ?? null,
      scopeType: (material.scope_type as string) ?? "",
      ownerTeacherId: (material.owner_teacher_id as string | null) ?? null,
      ownerOrganizationId: (material.owner_organization_id as string | null) ?? null,
      status: (material.status as string) ?? "",
      sourceFilePath: (material.source_file_path as string | null) ?? null,
      createdAt: (material.created_at as string) ?? "",
      updatedAt: (material.updated_at as string) ?? "",
      reviewState: computeReviewState(latestApproval?.decision),
      latestDecision,
      latestDecisionReason:
        latestDecision && latestApproval
          ? (decisionReasons.get(latestApproval.approvalId) ?? null)
          : null,
      schoolVisible: state?.isSchoolVisible ?? false,
      submittedAt: latestApproval?.createdAt ?? null,
      decidedAt: latestDecision ? latestApproval?.reviewedAt ?? null : null,
    };
  }),
  total,
  };
}

export async function listTeacherPublications(
  userId: string,
  options?: { pageSize?: number; page?: number },
): Promise<{ publications: TeacherPublicationSummary[]; total: number }> {
  const selectedOrganization = await getTeacherSelectedOrganization(userId);
  const supabase = createServerClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const { data: publications, error, count } = await supabase
    .from("assignment_publications")
    .select(
      `
      id,
      assignment_template_id,
      default_deadline,
      status,
      created_at,
      updated_at,
      assignment_templates!inner(id, title, description)
    `,
      { count: "exact" },
    )
    .eq("published_by_teacher_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw error;
  }

  const publicationIds = (publications ?? []).map((publication) => publication.id as string);
  const templateIds = (publications ?? []).map((publication) => publication.assignment_template_id as string);

  let classCounts: Record<string, number> = {};
  let materialCounts: Record<string, number> = {};
  let testCounts: Record<string, number> = {};

  if (publicationIds.length > 0) {
      const [{ data: publicationClasses }, { data: linkedMaterials }, { data: templates }] = await Promise.all([
      supabase
        .from("assignment_publication_classes")
        .select("assignment_publication_id, class_id")
        .in("assignment_publication_id", publicationIds)
        .is("deleted_at", null),
      supabase
        .from("assignment_template_materials")
        .select("assignment_template_id, material_id")
        .in("assignment_template_id", templateIds)
        .is("deleted_at", null),
      supabase
        .from("assignment_templates")
        .select("id, linked_test_id")
        .in("id", templateIds)
        .is("deleted_at", null),
    ]);

    classCounts = (publicationClasses ?? []).reduce((accumulator, item) => {
      accumulator[item.assignment_publication_id as string] =
        (accumulator[item.assignment_publication_id as string] ?? 0) + 1;
      return accumulator;
    }, {} as Record<string, number>);

    materialCounts = (linkedMaterials ?? []).reduce((accumulator, item) => {
      accumulator[item.assignment_template_id as string] =
        (accumulator[item.assignment_template_id as string] ?? 0) + 1;
      return accumulator;
    }, {} as Record<string, number>);

    testCounts = (templates ?? []).reduce((accumulator, item) => {
      if (item.linked_test_id) {
        accumulator[item.id as string] = 1;
      }
      return accumulator;
    }, {} as Record<string, number>);
  }

  return {
    publications: (publications ?? []).map((publication) => {
    const templateValue = publication.assignment_templates as unknown;
    const template = (Array.isArray(templateValue) ? templateValue[0] : templateValue) as
      | Record<string, unknown>
      | null;

    return {
      id: publication.id as string,
      templateId: publication.assignment_template_id as string,
      title: (template?.title as string | null) ?? null,
      description: (template?.description as string | null) ?? null,
      defaultDeadline: (publication.default_deadline as string | null) ?? null,
      classCount: classCounts[publication.id as string] ?? 0,
      linkedMaterialCount: materialCounts[publication.assignment_template_id as string] ?? 0,
      linkedTestCount: testCounts[publication.assignment_template_id as string] ?? 0,
      status: (publication.status as string) ?? "",
      createdAt: (publication.created_at as string) ?? "",
      updatedAt: (publication.updated_at as string) ?? "",
      organizationName: selectedOrganization.organizationName,
    };
  }),
  total: count ?? 0,
  };
}

export async function listTeacherPendingReviews(
  userId: string,
  options?: { classId?: string | null; pageSize?: number; page?: number },
): Promise<{ reviews: TeacherPendingReviewSummary[]; total: number }> {
  const supabase = createServerClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const { data: teacherClasses, error: classesError } = await supabase
    .from("class_teachers")
    .select("class_id")
    .eq("platform_user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (classesError) {
    throw classesError;
  }

  const classIds = (teacherClasses ?? []).map((teacherClass) => teacherClass.class_id as string);
  if (classIds.length === 0) {
    return { reviews: [], total: 0 };
  }

  let query = supabase
    .from("assignment_results")
    .select(
      `
      *,
      class_enrollments!inner(
        id,
        student_profile_id,
        student_profiles!left(id, display_name, student_login)
      ),
      assignment_publication_classes!inner(
        id,
        class_id,
        classes!left(id, title),
        assignment_publications!inner(
          id,
          assignment_template_id,
          assignment_templates!left(id, title, linked_test_id)
        )
      ),
      submission_reviews!left(id, status, reviewed_by_teacher_id, created_at)
    `,
      { count: "exact" },
    )
    .eq("status", "submitted")
    .in("assignment_publication_classes.class_id", classIds)
    .is("deleted_at", null);

  if (options?.classId && classIds.includes(options.classId)) {
    query = query.eq("assignment_publication_classes.class_id", options.classId);
  }

  const { data, error, count } = await query
    .order("test_submitted_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw error;
  }

  const total = count ?? 0;

  return {
    reviews: (data ?? []).map((result: Record<string, unknown>) => {
    const enrollment = result.class_enrollments as Record<string, unknown> | null;
    const studentProfile = enrollment?.student_profiles as Record<string, unknown> | null;
    const publicationClass = result.assignment_publication_classes as Record<string, unknown> | null;
    const classData = publicationClass?.classes as Record<string, unknown> | null;
    const publication = publicationClass?.assignment_publications as Record<string, unknown> | null;
    const template = publication?.assignment_templates as Record<string, unknown> | null;
    const review = result.submission_reviews as Record<string, unknown> | null;

    return {
      assignmentResultId: result.id as string,
      status: (result.status as string) ?? "",
      practiceSubmittedAt: (result.practice_submitted_at as string | null) ?? null,
      testSubmittedAt: (result.test_submitted_at as string | null) ?? null,
      hasLinkedTest: Boolean(template?.linked_test_id),
      student: {
        studentProfileId: (studentProfile?.id as string | null) ?? null,
        displayName: (studentProfile?.display_name as string | null) ?? null,
        studentLogin: (studentProfile?.student_login as string | null) ?? null,
      },
      class: {
        classId: (classData?.id as string | null) ?? null,
        title: (classData?.title as string | null) ?? null,
      },
      assignment: {
        publicationId: (publication?.id as string | null) ?? null,
        templateId: (template?.id as string | null) ?? null,
        title: (template?.title as string | null) ?? null,
      },
      review: review
        ? {
            reviewId: review.id as string,
            status: (review.status as string) ?? "",
            reviewedByTeacherId: (review.reviewed_by_teacher_id as string | null) ?? null,
            createdAt: (review.created_at as string) ?? "",
          }
        : null,
      isPending: !review || review.status === "draft",
    };
  }),
  total,
  };
}

export async function listTeacherNotifications(
  userId: string,
  options?: { read?: boolean | null; pageSize?: number },
): Promise<TeacherNotificationSummary[]> {
  const supabase = createServerClient();
  const pageSize = options?.pageSize ?? PAGE_SIZE;

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("recipient_type", "platform_user")
    .eq("recipient_platform_user_id", userId)
    .order("created_at", { ascending: false });

  if (options?.read === true) {
    query = query.not("read_at", "is", null);
  } else if (options?.read === false) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query.range(0, pageSize - 1);
  if (error) {
    throw error;
  }

  return (data ?? []).map((notification: Record<string, unknown>) => ({
    notificationId: notification.id as string,
    recipientType: (notification.recipient_type as string) ?? "",
    recipientPlatformUserId: (notification.recipient_platform_user_id as string) ?? "",
    type: (notification.type as string) ?? "",
    payloadJson: (notification.payload_json as Record<string, unknown>) ?? {},
    isRead: notification.read_at !== null,
    readAt: (notification.read_at as string | null) ?? null,
    createdAt: (notification.created_at as string) ?? "",
  }));
}

export async function listTeacherTests(
  userId: string,
  options?: { scopeType?: string | null; origin?: string | null; pageSize?: number; page?: number },
): Promise<{ tests: TeacherTestSummary[]; total: number }> {
  const supabase = createServerClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("tests")
    .select("*, test_questions!left(*), test_approvals!left(*)", { count: "exact" })
    .is("deleted_at", null);

  if (options?.origin) {
    query = query.eq("origin", options.origin);
  }

  if (options?.scopeType === "personal") {
    query = query.eq("scope_type", "personal").eq("owner_teacher_id", userId);
  } else if (options?.scopeType === "organization") {
    const { allOrganizationIds } = await getTeacherOrganizationContext(userId);
    if (allOrganizationIds.length === 0) {
      return { tests: [], total: 0 };
    }
    query = query.eq("scope_type", "organization").in("owner_organization_id", allOrganizationIds);
  } else {
    const { allOrganizationIds } = await getTeacherOrganizationContext(userId);
    if (allOrganizationIds.length > 0) {
      query = query.or(
        `and(scope_type.eq.personal,owner_teacher_id.eq.${userId}),` +
          `and(scope_type.eq.organization,owner_organization_id.in.(${allOrganizationIds.join(",")}))`,
      );
    } else {
      query = query.eq("scope_type", "personal").eq("owner_teacher_id", userId);
    }
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw error;
  }

  return {
    tests: (data ?? []).map((test: Record<string, unknown>) => {
    const questions = (test.test_questions as Array<Record<string, unknown>>) ?? [];
    const approvals = (test.test_approvals as Array<Record<string, unknown>>) ?? [];
    const pendingApproval = approvals.find((approval) => approval.decision === "pending");

    return {
      testId: test.id as string,
      title: (test.title as string) ?? "",
      description: (test.description as string | null) ?? null,
      scopeType: (test.scope_type as string) ?? "",
      ownerTeacherId: (test.owner_teacher_id as string | null) ?? null,
      ownerOrganizationId: (test.owner_organization_id as string | null) ?? null,
      status: ((test.status as TeacherTestSummary["status"]) ?? "draft"),
      origin: ((test.origin as TeacherTestSummary["origin"]) ?? "manual"),
      linkedTestId: (test.linked_test_id as string | null) ?? null,
      sourceFilePath: (test.source_file_path as string | null) ?? null,
      questionCount: questions.length,
      totalPoints: null,
      createdAt: (test.created_at as string) ?? "",
      updatedAt: (test.updated_at as string) ?? "",
      pendingApproval: pendingApproval
        ? {
            approvalId: pendingApproval.id as string,
            decision: (pendingApproval.decision as string | null) ?? null,
            requestedAt: (pendingApproval.created_at as string) ?? "",
          }
        : null,
    };
  }),
  total: count ?? 0,
  };
}

export async function listTeacherSchoolLibraryTests(
  userId: string,
): Promise<TeacherSchoolLibraryTestSummary[]> {
  const { activeOrganizationId } = await getTeacherOrganizationContext(userId);
  if (!activeOrganizationId) {
    return [];
  }

  const supabase = createServerClient();
  const { data: tests, error } = await supabase
    .from("tests")
    .select(
      `
      id,
      title,
      description,
      owner_teacher_id,
      test_questions!left(id),
      test_approvals!left(id, decision, created_at)
    `,
    )
    .eq("scope_type", "organization")
    .eq("owner_organization_id", activeOrganizationId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  const ownerTeacherIds = Array.from(
    new Set((tests ?? []).map((test: Record<string, unknown>) => test.owner_teacher_id as string | null).filter(Boolean)),
  ) as string[];

  const teacherNames: Record<string, string> = {};
  if (ownerTeacherIds.length > 0) {
    const { data: teachers, error: teachersError } = await supabase
      .from("platform_users")
      .select("id, display_name")
      .in("id", ownerTeacherIds);

    if (teachersError) {
      throw teachersError;
    }

    for (const teacher of teachers ?? []) {
      teacherNames[teacher.id as string] = (teacher.display_name as string) ?? "";
    }
  }

  return (tests ?? [])
    .filter((test: Record<string, unknown>) => {
      const approvals = (test.test_approvals as Array<Record<string, unknown>>) ?? [];
      return approvals.some((approval) => approval.decision === "approved");
    })
    .map((test: Record<string, unknown>) => {
      const approvals = (test.test_approvals as Array<Record<string, unknown>>) ?? [];
      const questions = (test.test_questions as Array<Record<string, unknown>>) ?? [];
      const approvedAt =
        approvals
          .filter((approval) => approval.decision === "approved")
          .sort(
            (left, right) =>
              new Date((right.created_at as string) ?? 0).getTime() -
              new Date((left.created_at as string) ?? 0).getTime(),
          )[0]?.created_at ?? null;

      return {
        testId: test.id as string,
        title: (test.title as string) ?? "",
        description: (test.description as string | null) ?? null,
        ownerTeacherName: test.owner_teacher_id
          ? (teacherNames[test.owner_teacher_id as string] ?? null)
          : null,
        questionCount: questions.length,
        approvedAt: (approvedAt as string | null) ?? null,
    };
  });
}

export async function listTeacherAssignmentPublications(
  userId: string,
  options?: { status?: string | null; templateId?: string | null; classId?: string | null; pageSize?: number },
): Promise<TeacherAssignmentPublicationSummary[]> {
  const supabase = createServerClient();
  const pageSize = options?.pageSize ?? PAGE_SIZE;
  const classJoinHint = options?.classId ? "inner" : "left";

  let query = supabase
    .from("assignment_publications")
    .select(
      `*,
      assignment_templates!inner(id, title, teacher_id, has_practice, has_test),
      assignment_publication_classes!${classJoinHint}(id, class_id, deadline_override, status)`,
    )
    .eq("published_by_teacher_id", userId)
    .is("deleted_at", null);

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.templateId) {
    query = query.eq("assignment_template_id", options.templateId);
  }

  if (options?.classId) {
    query = query.eq("assignment_publication_classes.class_id", options.classId);
  }

  const { data, error } = await query
    .order("published_at", { ascending: false })
    .range(0, pageSize - 1);

  if (error) {
    throw error;
  }

  return (data ?? []).map((publication: Record<string, unknown>) => {
    const template = publication.assignment_templates as Record<string, unknown> | null;
    const classes = (publication.assignment_publication_classes as Array<Record<string, unknown>>) ?? [];

    return {
      publicationId: publication.id as string,
      templateId: publication.assignment_template_id as string,
      templateTitle: (template?.title as string | null) ?? null,
      hasPractice: Boolean(template?.has_practice),
      hasTest: Boolean(template?.has_test),
      publishedByTeacherId: (publication.published_by_teacher_id as string) ?? "",
      defaultDeadline: (publication.default_deadline as string | null) ?? null,
      status: (publication.status as string) ?? "",
      publishedAt: (publication.published_at as string | null) ?? null,
      createdAt: (publication.created_at as string) ?? "",
      updatedAt: (publication.updated_at as string) ?? "",
      classCount: classes.length,
      classTargets: classes.map((classTarget) => ({
        publicationClassId: classTarget.id as string,
        classId: classTarget.class_id as string,
        deadlineOverride: (classTarget.deadline_override as string | null) ?? null,
        effectiveDeadline:
          (classTarget.deadline_override as string | null) ??
          ((publication.default_deadline as string | null) ?? null),
        status: (classTarget.status as string) ?? "",
      })),
    };
  });
}
