import { cache } from "react";

import { createServerClient, getAuthUserEmails } from "@/lib/supabase/server-client";
import { t } from "@/lib/translations";

export interface AdminStudentSummary {
  id: string;
  studentLogin: string;
  displayName: string;
  status: string;
  enrollmentCount: number;
  submissionCount: number;
}

export interface AdminTeacherSummary {
  id: string;
  email: string;
  displayName: string;
  status: string;
  role: string;
  membershipsCount: number;
  ownedClassesCount: number;
  selectedOrganizationId: string | null;
}

export interface AdminOrganizationSummary {
  organizationId: string;
  name: string;
  slug: string;
  status: string;
  teacherCount: number;
  studentCount: number;
  createdAt: string;
}

export interface AdminClassSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  organizationId: string;
  teacherId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  organizationName: string;
  teacherName: string;
  activeJoinCode: string;
  studentCount: number;
}

export interface AdminNotificationSummary {
  id: string;
  actorType: string;
  actorId: string | null;
  recipientType: string;
  recipientId: string;
  type: string;
  payload: Record<string, string>;
  readAt: string | null;
  createdAt: string;
}

export interface AdminDashboardSummary {
  totalOrganizations: number;
  pendingOrganizations: number;
  pendingMaterials: number;
  pendingTests: number;
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
}

export interface AdminStudentEnrollmentDetail {
  id: string;
  studentId: string;
  classId: string;
  enrollmentSource: string;
  joinedAt: string;
  className: string;
  organizationName: string;
}

export interface AdminStudentOrganizationDetail {
  id: string;
  studentId: string;
  organizationId: string;
  status: string;
  joinedAt: string;
  organizationName: string;
}

export interface AdminStudentDetail {
  id: string;
  displayName: string;
  studentLogin: string;
  email: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  enrollments: AdminStudentEnrollmentDetail[];
  memberships: AdminStudentOrganizationDetail[];
  submissionCount: number;
}

export interface AdminTeacherMembershipDetail {
  id: string;
  teacherId: string;
  organizationId: string;
  role: string;
  status: string;
  joinedAt: string;
  organizationName: string;
  organizationSlug: string;
  organizationStatus: string;
}

export interface AdminTeacherOwnedClassDetail {
  classId: string;
  title: string;
  organizationName: string;
  studentCount: number;
  status: string;
}

export interface AdminTeacherDetail {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  memberships: AdminTeacherMembershipDetail[];
  classes: AdminTeacherOwnedClassDetail[];
}

export interface AdminOrganizationMemberDetail {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  role: string;
  status: string;
  joinedAt: string;
}

export interface AdminOrganizationClassDetail {
  id: string;
  name: string;
  teacherName: string;
  studentCount: number;
  enrollmentCount: number;
  description: string | null;
  updatedAt: string;
  status: string;
}

export interface AdminOrganizationDetail {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  createdByTeacherId: string;
  createdByTeacherName: string;
  members: AdminOrganizationMemberDetail[];
  classes: AdminOrganizationClassDetail[];
}

export interface AdminSystemHealth {
  status: string;
  version: string;
  timestamp: string;
  database: {
    status: string;
    latency: number;
  };
  stats: {
    organizations: number;
    teachers: number;
    students: number;
    classes: number;
  };
}

export interface AdminAssignmentTemplateSummary {
  templateId: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  title: string;
  description: string | null;
  hasPractice: boolean;
  hasTest: boolean;
  linkedTestId: string | null;
  status: string;
  linkedMaterialCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPendingMaterialApprovalSummary {
  approvalId: string;
  materialId: string;
  title: string;
  description: string | null;
  sourceFilePath: string | null;
  organizationName: string;
  requestedByTeacherName: string;
  requestedByTeacherEmail: string;
  submittedAt: string;
}

export interface AdminPendingOrganizationApprovalSummary {
  organizationId: string;
  organizationName: string;
  slug: string;
  type: string;
  description: string | null;
  requestedByTeacherName: string;
  requestedByTeacherEmail: string;
  requestedAt: string;
}

export interface AdminTestQuestionSummary {
  questionId: string;
  questionType: string;
  prompt: string;
  images: string[];
  optionsJson: Record<string, unknown> | null;
  answerJson: Record<string, unknown> | null;
  explanation: string | null;
}

export interface AdminPendingTestApprovalSummary {
  approvalId: string;
  testId: string;
  title: string;
  description: string | null;
  scopeType: string;
  origin: string;
  ownerTeacherId: string;
  ownerOrganizationId: string | null;
  testStatus: string;
  decision: string;
  questions: AdminTestQuestionSummary[];
  isReapproval: boolean;
  previousQuestions: AdminTestQuestionSummary[] | null;
  requestedBy: {
    userId: string;
    email: string;
    displayName: string;
  } | null;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPendingTestDeletionRequestSummary {
  requestId: string;
  testId: string;
  title: string;
  description: string | null;
  scopeType: string;
  ownerTeacherId: string;
  reason: string | null;
  decision: string;
  questionCount?: number;
  requestedBy: {
    userId: string;
    email: string;
    displayName: string;
  } | null;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
}

function slugifyClassTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function countBy<T extends Record<string, unknown>>(items: T[] | null, key: keyof T): Map<string, number> {
  const map = new Map<string, number>();

  for (const item of items ?? []) {
    const value = item[key];
    if (typeof value !== "string" || value.length === 0) {
      continue;
    }
    map.set(value, (map.get(value) ?? 0) + 1);
  }

  return map;
}

export const getAdminDashboardSummary = cache(async (): Promise<AdminDashboardSummary> => {
  const supabase = createServerClient();

  const [
    organizationsCount,
    pendingOrganizationsCount,
    pendingMaterialsCount,
    pendingTestsCount,
    studentsCount,
    teachersCount,
    classesCount,
  ] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .is("deleted_at", null),
    supabase
      .from("material_approvals")
      .select("id", { count: "exact", head: true })
      .eq("decision", "pending")
      .is("deleted_at", null),
    supabase
      .from("test_approvals")
      .select("id", { count: "exact", head: true })
      .eq("decision", "pending")
      .is("deleted_at", null),
    supabase.from("student_profiles").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("platform_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "teacher")
      .is("deleted_at", null),
    supabase.from("classes").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);

  return {
    totalOrganizations: organizationsCount.count ?? 0,
    pendingOrganizations: pendingOrganizationsCount.count ?? 0,
    pendingMaterials: pendingMaterialsCount.count ?? 0,
    pendingTests: pendingTestsCount.count ?? 0,
    totalStudents: studentsCount.count ?? 0,
    totalTeachers: teachersCount.count ?? 0,
    totalClasses: classesCount.count ?? 0,
  };
});

export const listAdminStudents = cache(async (): Promise<AdminStudentSummary[]> => {
  const supabase = createServerClient();

  const { data: students, error } = await supabase
    .from("student_profiles")
    .select("id, student_login, display_name, status, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const studentIds = (students ?? []).map((student) => student.id);
  if (studentIds.length === 0) {
    return [];
  }

  const [{ data: enrollments }, { data: assignmentResults }] = await Promise.all([
    supabase
      .from("class_enrollments")
      .select("student_profile_id")
      .in("student_profile_id", studentIds)
      .is("deleted_at", null),
    supabase
      .from("assignment_results")
      .select("class_enrollments!inner(student_profile_id)")
      .in("class_enrollments.student_profile_id", studentIds)
      .is("deleted_at", null),
  ]);

  const enrollmentCounts = countBy(
    (enrollments as Array<{ student_profile_id: string }> | null) ?? [],
    "student_profile_id",
  );

  const submissionCounts = new Map<string, number>();
  for (const result of (assignmentResults as Array<{ class_enrollments: { student_profile_id: string } | Array<{ student_profile_id: string }> }> | null) ?? []) {
    const enrollment = Array.isArray(result.class_enrollments) ? result.class_enrollments[0] : result.class_enrollments;
    const studentId = enrollment?.student_profile_id;
    if (typeof studentId !== "string") {
      continue;
    }
    submissionCounts.set(studentId, (submissionCounts.get(studentId) ?? 0) + 1);
  }

  return students
    .map((student) => ({
      id: student.id,
      studentLogin: student.student_login,
      displayName: student.display_name,
      status: student.status,
      enrollmentCount: enrollmentCounts.get(student.id) ?? 0,
      submissionCount: submissionCounts.get(student.id) ?? 0,
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
});

export const listAdminTeachers = cache(async (): Promise<AdminTeacherSummary[]> => {
  const supabase = createServerClient();

  const { data: teachers, error } = await supabase
    .from("platform_users")
    .select("id, auth_user_id, display_name, role, status, created_at")
    .eq("role", "teacher")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const teacherIds = (teachers ?? []).map((teacher) => teacher.id);
  const authEmails = await getAuthUserEmails();

  const [membershipsRes, classTeachersRes] = teacherIds.length
    ? await Promise.all([
        supabase
          .from("organization_memberships")
          .select("platform_user_id, organization_id, joined_at, status")
          .in("platform_user_id", teacherIds)
          .is("deleted_at", null),
        supabase
          .from("class_teachers")
          .select("platform_user_id, is_primary")
          .in("platform_user_id", teacherIds)
          .is("deleted_at", null)
          .eq("status", "active"),
      ])
    : [{ data: [] }, { data: [] }];

  const membershipsByTeacher = new Map<
    string,
    Array<{ organizationId: string; joinedAt: string | null; status: string }>
  >();
  for (const membership of (membershipsRes.data as Array<{
    platform_user_id: string;
    organization_id: string;
    joined_at: string | null;
    status: string;
  }> | null) ?? []) {
    const list = membershipsByTeacher.get(membership.platform_user_id) ?? [];
    list.push({
      organizationId: membership.organization_id,
      joinedAt: membership.joined_at,
      status: membership.status,
    });
    membershipsByTeacher.set(membership.platform_user_id, list);
  }

  const ownedClassCounts = new Map<string, number>();
  for (const classTeacher of (classTeachersRes.data as Array<{ platform_user_id: string; is_primary: boolean }> | null) ?? []) {
    if (!classTeacher.is_primary) {
      continue;
    }
    ownedClassCounts.set(
      classTeacher.platform_user_id,
      (ownedClassCounts.get(classTeacher.platform_user_id) ?? 0) + 1,
    );
  }

  return teachers
    .map((teacher) => {
      const memberships = membershipsByTeacher.get(teacher.id) ?? [];
      const selectedOrganizationId =
        memberships
          .filter((membership) => membership.status === "active")
          .sort((left, right) => (left.joinedAt ?? "").localeCompare(right.joinedAt ?? ""))[0]
          ?.organizationId ?? null;

      return {
        id: teacher.id,
        email: teacher.auth_user_id ? (authEmails.get(teacher.auth_user_id) ?? "Noma'lum o'qituvchi") : "Noma'lum o'qituvchi",
        displayName: teacher.display_name,
        status: teacher.status,
        role: teacher.role,
        membershipsCount: memberships.length,
        ownedClassesCount: ownedClassCounts.get(teacher.id) ?? 0,
        selectedOrganizationId,
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
});

export const listAdminOrganizations = cache(
  async (status?: string): Promise<AdminOrganizationSummary[]> => {
    const supabase = createServerClient();

    let query = supabase
      .from("organizations")
      .select("id, name, slug, status, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: organizations, error } = await query;

    if (error) {
      throw error;
    }

    const organizationIds = (organizations ?? []).map((organization) => organization.id);
    if (organizationIds.length === 0) {
      return [];
    }

    const [membershipsRes, studentsRes] = await Promise.all([
      supabase
        .from("organization_memberships")
        .select("organization_id")
        .in("organization_id", organizationIds)
        .is("deleted_at", null),
      supabase
        .from("organization_students")
        .select("organization_id")
        .in("organization_id", organizationIds)
        .is("deleted_at", null),
    ]);

    const teacherCounts = countBy(
      (membershipsRes.data as Array<{ organization_id: string }> | null) ?? [],
      "organization_id",
    );
    const studentCounts = countBy(
      (studentsRes.data as Array<{ organization_id: string }> | null) ?? [],
      "organization_id",
    );

    return organizations.map((organization) => ({
      organizationId: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      teacherCount: teacherCounts.get(organization.id) ?? 0,
      studentCount: studentCounts.get(organization.id) ?? 0,
      createdAt: organization.created_at,
    }));
  },
);

export const listAdminClasses = cache(async (): Promise<AdminClassSummary[]> => {
  const supabase = createServerClient();

  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, title, description, organization_id, status, created_at, updated_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const classIds = (classes ?? []).map((classItem) => classItem.id);
  const organizationIds = [...new Set((classes ?? []).map((classItem) => classItem.organization_id))];

  const [organizationsRes, classTeachersRes, joinCodesRes, enrollmentsRes] = classIds.length
    ? await Promise.all([
        supabase
          .from("organizations")
          .select("id, name")
          .in("id", organizationIds)
          .is("deleted_at", null),
        supabase
          .from("class_teachers")
          .select("class_id, platform_user_id, is_primary, platform_users(id, display_name)")
          .in("class_id", classIds)
          .is("deleted_at", null)
          .eq("status", "active"),
        supabase
          .from("class_join_codes")
          .select("class_id, code, created_at")
          .in("class_id", classIds)
          .eq("status", "active")
          .is("deleted_at", null),
        supabase
          .from("class_enrollments")
          .select("class_id")
          .in("class_id", classIds)
          .eq("status", "active")
          .is("deleted_at", null),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const organizationNames = new Map(
    ((organizationsRes.data as Array<{ id: string; name: string }> | null) ?? []).map((organization) => [
      organization.id,
      organization.name,
    ]),
  );

  const teacherByClass = new Map<string, { teacherId: string | null; teacherName: string }>();
  for (const row of (classTeachersRes.data as Array<{
    class_id: string;
    platform_user_id: string | null;
    is_primary: boolean;
    platform_users: { id: string; display_name: string } | Array<{ id: string; display_name: string }> | null;
  }> | null) ?? []) {
    const existing = teacherByClass.get(row.class_id);
    if (existing && !row.is_primary) {
      continue;
    }
    const teacher = Array.isArray(row.platform_users) ? row.platform_users[0] : row.platform_users;
    teacherByClass.set(row.class_id, {
      teacherId: row.platform_user_id,
      teacherName: teacher?.display_name ?? "Unknown teacher",
    });
  }

  const joinCodeByClass = new Map<string, string>();
  for (const joinCode of (joinCodesRes.data as Array<{ class_id: string; code: string; created_at: string }> | null) ?? []) {
    const existing = joinCodeByClass.get(joinCode.class_id);
    if (!existing) {
      joinCodeByClass.set(joinCode.class_id, joinCode.code);
    }
  }

  const studentCounts = countBy(
    (enrollmentsRes.data as Array<{ class_id: string }> | null) ?? [],
    "class_id",
  );

  return (classes ?? []).map((classItem) => {
    const teacher = teacherByClass.get(classItem.id);

    return {
      id: classItem.id,
      name: classItem.title,
      slug: slugifyClassTitle(classItem.title),
      description: classItem.description,
      organizationId: classItem.organization_id,
      teacherId: teacher?.teacherId ?? "",
      status: classItem.status,
      createdAt: classItem.created_at,
      updatedAt: classItem.updated_at,
      organizationName: organizationNames.get(classItem.organization_id) ?? "Noma'lum tashkilot",
      teacherName: teacher?.teacherName ?? "Biriktirilmagan",
      activeJoinCode: joinCodeByClass.get(classItem.id) ?? "Kod yo'q",
      studentCount: studentCounts.get(classItem.id) ?? 0,
    };
  });
});

export const listAdminNotifications = cache(async (): Promise<AdminNotificationSummary[]> => {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, recipient_type, recipient_platform_user_id, recipient_student_profile_id, type, payload_json, read_at, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data as Array<Record<string, unknown>> | null) ?? []).map((notification) => ({
    id: notification.id as string,
    actorType: "system",
    actorId: null,
    recipientType: notification.recipient_type as string,
    recipientId:
      ((notification.recipient_platform_user_id as string | null) ??
        (notification.recipient_student_profile_id as string | null) ??
        "") as string,
    type: notification.type as string,
    payload: (notification.payload_json as Record<string, string> | null) ?? {},
    readAt: (notification.read_at as string | null) ?? null,
    createdAt: notification.created_at as string,
  }));
});

export const getAdminStudentDetail = cache(async (studentId: string): Promise<AdminStudentDetail | null> => {
  const supabase = createServerClient();

  const { data: student, error } = await supabase
    .from("student_profiles")
    .select("id, student_login, display_name, status, created_at, updated_at")
    .eq("id", studentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!student) {
    return null;
  }

  const [membershipsRes, enrollmentsRes] = await Promise.all([
    supabase
      .from("organization_students")
      .select("id, student_profile_id, status, joined_at, organizations!inner(name)")
      .eq("student_profile_id", studentId)
      .is("deleted_at", null),
    supabase
      .from("class_enrollments")
      .select("id, student_profile_id, source, joined_at, classes!inner(id, title, organization_id, organizations!inner(name))")
      .eq("student_profile_id", studentId)
      .is("deleted_at", null),
  ]);

  const enrollmentIds = ((enrollmentsRes.data as Array<{ id: string }> | null) ?? []).map((enrollment) => enrollment.id);
  const submissionsCount = enrollmentIds.length
    ? (
        await supabase
          .from("assignment_results")
          .select("id", { count: "exact", head: true })
          .in("class_enrollment_id", enrollmentIds)
          .is("deleted_at", null)
      ).count ?? 0
    : 0;

  const memberships: AdminStudentOrganizationDetail[] = ((membershipsRes.data as Array<Record<string, unknown>> | null) ?? []).map((membership) => {
    const organization = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
    return {
      id: membership.id as string,
      studentId,
      organizationId: "" ,
      status: membership.status as string,
      joinedAt: membership.joined_at as string,
      organizationName: ((organization as Record<string, unknown> | null)?.name as string) ?? "Noma'lum tashkilot",
    };
  });

  const enrollments: AdminStudentEnrollmentDetail[] = ((enrollmentsRes.data as Array<Record<string, unknown>> | null) ?? []).map((enrollment) => {
    const classRecord = Array.isArray(enrollment.classes) ? enrollment.classes[0] : enrollment.classes;
    const organization = Array.isArray((classRecord as Record<string, unknown> | null)?.organizations)
      ? ((classRecord as Record<string, unknown>).organizations as Array<Record<string, unknown>>)[0]
      : (classRecord as Record<string, unknown> | null)?.organizations;

    return {
      id: enrollment.id as string,
      studentId,
      classId: ((classRecord as Record<string, unknown> | null)?.id as string) ?? "",
      enrollmentSource: (enrollment.source as string) ?? "unknown",
      joinedAt: enrollment.joined_at as string,
      className: ((classRecord as Record<string, unknown> | null)?.title as string) ?? "Noma'lum",
      organizationName: ((organization as Record<string, unknown> | null)?.name as string) ?? "Noma'lum tashkilot",
    };
  });

  return {
    id: student.id,
    displayName: student.display_name,
    studentLogin: student.student_login,
    email: null,
    status: student.status,
    createdAt: student.created_at,
    updatedAt: student.updated_at,
    enrollments,
    memberships,
    submissionCount: submissionsCount,
  };
});

export const getAdminTeacherDetail = cache(async (teacherId: string): Promise<AdminTeacherDetail | null> => {
  const supabase = createServerClient();
  const authEmails = await getAuthUserEmails();

  const { data: teacher, error } = await supabase
    .from("platform_users")
    .select("id, auth_user_id, display_name, role, status")
    .eq("id", teacherId)
    .eq("role", "teacher")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!teacher) {
    return null;
  }

  const [membershipsRes, classTeachersRes] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("id, platform_user_id, organization_id, role, status, joined_at, organizations!inner(name, slug, status)")
      .eq("platform_user_id", teacherId)
      .is("deleted_at", null),
    supabase
      .from("class_teachers")
      .select("class_id, is_primary, classes!inner(id, title, status, organization_id, organizations!inner(name))")
      .eq("platform_user_id", teacherId)
      .eq("status", "active")
      .is("deleted_at", null),
  ]);

  const ownedClassesRaw = ((classTeachersRes.data as Array<Record<string, unknown>> | null) ?? []).filter(
    (classTeacher) => classTeacher.is_primary === true,
  );

  const ownedClassIds = ownedClassesRaw
    .map((classTeacher) => {
      const classRecord = Array.isArray(classTeacher.classes) ? classTeacher.classes[0] : classTeacher.classes;
      return (classRecord as Record<string, unknown> | null)?.id as string | undefined;
    })
    .filter((value): value is string => Boolean(value));

  const enrollmentsRes = ownedClassIds.length
    ? await supabase
        .from("class_enrollments")
        .select("class_id")
        .in("class_id", ownedClassIds)
        .eq("status", "active")
        .is("deleted_at", null)
    : { data: [] };

  const studentCounts = countBy(
    (enrollmentsRes.data as Array<{ class_id: string }> | null) ?? [],
    "class_id",
  );

  const memberships: AdminTeacherMembershipDetail[] = ((membershipsRes.data as Array<Record<string, unknown>> | null) ?? []).map((membership) => {
    const organization = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
    return {
      id: membership.id as string,
      teacherId,
      organizationId: (membership.organization_id as string) ?? "",
      role: membership.role as string,
      status: membership.status as string,
      joinedAt: membership.joined_at as string,
      organizationName: ((organization as Record<string, unknown> | null)?.name as string) ?? "Noma'lum tashkilot",
      organizationSlug: ((organization as Record<string, unknown> | null)?.slug as string) ?? "",
      organizationStatus: ((organization as Record<string, unknown> | null)?.status as string) ?? "unknown",
    };
  });

  const classes: AdminTeacherOwnedClassDetail[] = ownedClassesRaw.map((classTeacher) => {
    const classRecord = Array.isArray(classTeacher.classes) ? classTeacher.classes[0] : classTeacher.classes;
    const organization = Array.isArray((classRecord as Record<string, unknown> | null)?.organizations)
      ? ((classRecord as Record<string, unknown>).organizations as Array<Record<string, unknown>>)[0]
      : (classRecord as Record<string, unknown> | null)?.organizations;
    const classId = ((classRecord as Record<string, unknown> | null)?.id as string) ?? "";

    return {
      classId,
      title: ((classRecord as Record<string, unknown> | null)?.title as string) ?? "Noma'lum",
      organizationName: ((organization as Record<string, unknown> | null)?.name as string) ?? "Noma'lum tashkilot",
      studentCount: studentCounts.get(classId) ?? 0,
      status: ((classRecord as Record<string, unknown> | null)?.status as string) ?? "unknown",
    };
  });

  return {
    id: teacher.id,
    email: teacher.auth_user_id ? (authEmails.get(teacher.auth_user_id) ?? "Unknown") : "Unknown",
    displayName: teacher.display_name,
    role: teacher.role,
    status: teacher.status,
    memberships,
    classes,
  };
});

export const getAdminOrganizationDetail = cache(async (organizationId: string): Promise<AdminOrganizationDetail | null> => {
  const supabase = createServerClient();
  const authEmails = await getAuthUserEmails();

  const { data: organization, error } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, status, created_at, approved_at, created_by_platform_user_id, platform_users!organizations_created_by_platform_user_id_fkey(id, auth_user_id, display_name)",
    )
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!organization) {
    return null;
  }

  const [membershipsRes, classesRes] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("id, platform_user_id, role, status, joined_at, platform_users!inner(id, auth_user_id, display_name)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    supabase
      .from("classes")
      .select("id, title, description, status, updated_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
  ]);

  const classes = (classesRes.data as Array<{ id: string; title: string; description: string | null; status: string; updated_at: string }> | null) ?? [];
  const classIds = classes.map((classItem) => classItem.id);

  const [classTeachersRes, enrollmentsRes] = classIds.length
    ? await Promise.all([
        supabase
          .from("class_teachers")
          .select("class_id, is_primary, platform_users!inner(display_name)")
          .in("class_id", classIds)
          .eq("status", "active")
          .is("deleted_at", null),
        supabase
          .from("class_enrollments")
          .select("class_id")
          .in("class_id", classIds)
          .eq("status", "active")
          .is("deleted_at", null),
      ])
    : [{ data: [] }, { data: [] }];

  const classTeacherNames = new Map<string, string>();
  for (const row of (classTeachersRes.data as Array<Record<string, unknown>> | null) ?? []) {
    if (classTeacherNames.has(row.class_id as string) && row.is_primary !== true) {
      continue;
    }
    const user = Array.isArray(row.platform_users) ? row.platform_users[0] : row.platform_users;
    classTeacherNames.set(row.class_id as string, ((user as Record<string, unknown> | null)?.display_name as string) ?? "Noma'lum o'qituvchi");
  }

  const studentCounts = countBy(
    (enrollmentsRes.data as Array<{ class_id: string }> | null) ?? [],
    "class_id",
  );

  const creator = Array.isArray(organization.platform_users) ? organization.platform_users[0] : organization.platform_users;

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    type: "school",
    status: organization.status,
    createdAt: organization.created_at,
    approvedAt: organization.approved_at,
    createdByTeacherId: organization.created_by_platform_user_id ?? "",
    createdByTeacherName: ((creator as Record<string, unknown> | null)?.display_name as string) ?? "Noma'lum",
    members: ((membershipsRes.data as Array<Record<string, unknown>> | null) ?? []).map((membership) => {
      const user = Array.isArray(membership.platform_users) ? membership.platform_users[0] : membership.platform_users;
      const authUserId = ((user as Record<string, unknown> | null)?.auth_user_id as string | undefined) ?? null;

      return {
        id: membership.id as string,
        teacherId: (membership.platform_user_id as string) ?? "",
        teacherName: ((user as Record<string, unknown> | null)?.display_name as string) ?? "Noma'lum o'qituvchi",
        teacherEmail: authUserId ? (authEmails.get(authUserId) ?? "Noma'lum") : "Noma'lum",
        role: membership.role as string,
        status: membership.status as string,
        joinedAt: membership.joined_at as string,
      };
    }),
    classes: classes.map((classItem) => ({
      id: classItem.id,
      name: classItem.title,
      teacherName: classTeacherNames.get(classItem.id) ?? "Noma'lum o'qituvchi",
      studentCount: studentCounts.get(classItem.id) ?? 0,
      enrollmentCount: studentCounts.get(classItem.id) ?? 0,
      description: classItem.description,
      updatedAt: classItem.updated_at,
      status: classItem.status,
    })),
  };
});

export const getAdminSystemHealth = cache(async (): Promise<AdminSystemHealth> => {
  const supabase = createServerClient();

  const startTime = Date.now();
  const { error } = await supabase.from("platform_users").select("id", { count: "exact", head: true }).limit(1);
  const dbLatency = Date.now() - startTime;

  const [organizations, teachers, students, classes] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("platform_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "teacher")
      .is("deleted_at", null),
    supabase.from("student_profiles").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("classes").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);

  const dbStatus = error ? "error" : "healthy";

  return {
    status: dbStatus === "healthy" ? "healthy" : "degraded",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      latency: dbLatency,
    },
    stats: {
      organizations: organizations.count ?? 0,
      teachers: teachers.count ?? 0,
      students: students.count ?? 0,
      classes: classes.count ?? 0,
    },
  };
});

function parsePreviousQuestions(raw: unknown): AdminTestQuestionSummary[] | null {
  if (!Array.isArray(raw)) return null;

  return raw.map((question: Record<string, unknown>, index: number) => ({
    questionId: (question.id ?? question.questionId ?? `prev-${index}`) as string,
    questionType: (question.questionType as string) ?? "unknown",
    prompt: (question.prompt as string) ?? "",
    optionsJson: (question.optionsJson ?? question.options_json ?? null) as Record<string, unknown> | null,
    answerJson: (question.answerJson ?? question.answer_json ?? null) as Record<string, unknown> | null,
    explanation: (question.explanation ?? null) as string | null,
    images: ((question.images as string[]) ?? (question.imageUrl ? [question.imageUrl as string] : [])),
  }));
}

export const listAdminAssignments = cache(async (): Promise<AdminAssignmentTemplateSummary[]> => {
  const supabase = createServerClient();
  const authEmails = await getAuthUserEmails();

  const { data, error } = await supabase
    .from("assignment_templates")
    .select(
      `
      id,
      teacher_id,
      title,
      description,
      has_practice,
      has_test,
      linked_test_id,
      status,
      created_at,
      updated_at,
      platform_users!assignment_templates_teacher_id_fkey(
        id,
        auth_user_id,
        display_name
      ),
      assignment_template_materials(
        id
      )
    `,
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data as Array<Record<string, unknown>> | null) ?? [])
    .map((template) => {
      const teacher = Array.isArray(template.platform_users) ? template.platform_users[0] : template.platform_users;
      const authUserId = ((teacher as Record<string, unknown> | null)?.auth_user_id as string | undefined) ?? null;
      const materials = (template.assignment_template_materials as Array<Record<string, unknown>> | null) ?? [];

      return {
        templateId: template.id as string,
        teacherId: template.teacher_id as string,
        teacherName: ((teacher as Record<string, unknown> | null)?.display_name as string) ?? "Noma'lum",
        teacherEmail: authUserId ? (authEmails.get(authUserId) ?? "Noma'lum") : "Noma'lum",
        title: template.title as string,
        description: (template.description as string | null) ?? null,
        hasPractice: Boolean(template.has_practice),
        hasTest: Boolean(template.has_test),
        linkedTestId: (template.linked_test_id as string | null) ?? null,
        status: template.status as string,
        linkedMaterialCount: materials.length,
        createdAt: template.created_at as string,
        updatedAt: template.updated_at as string,
      };
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
});

export const listAdminPendingMaterialApprovals = cache(async (): Promise<AdminPendingMaterialApprovalSummary[]> => {
  const supabase = createServerClient();
  const authEmails = await getAuthUserEmails();

  const { data, error } = await supabase
    .from("material_approvals")
    .select(
      `
      id,
      material_id,
      organization_id,
      created_at,
      materials!inner(
        id,
        title,
        description,
        source_file_path
      ),
      platform_users!material_approvals_requested_by_platform_user_id_fkey(
        id,
        auth_user_id,
        display_name
      )
    `,
    )
    .eq("decision", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const targetOrgIds = ((data as Array<Record<string, unknown>> | null) ?? [])
    .map((approval) => approval.organization_id as string | null)
    .filter((id): id is string => Boolean(id));

  const orgNames = new Map<string, string>();
  if (targetOrgIds.length > 0) {
    const { data: orgs } = await supabase.from("organizations").select("id, name").in("id", [...new Set(targetOrgIds)]);
    for (const org of (orgs ?? [])) {
      orgNames.set(org.id, org.name);
    }
  }

  return ((data as Array<Record<string, unknown>> | null) ?? []).map((approval) => {
    const material = Array.isArray(approval.materials) ? approval.materials[0] : approval.materials;
    const requester = Array.isArray(approval.platform_users) ? approval.platform_users[0] : approval.platform_users;
    const authUserId = ((requester as Record<string, unknown> | null)?.auth_user_id as string | undefined) ?? null;
    const targetOrgId = (approval.organization_id as string | null) ?? null;

    return {
      approvalId: approval.id as string,
      materialId: approval.material_id as string,
      title: ((material as Record<string, unknown> | null)?.title as string) ?? "Nomsiz",
      description: ((material as Record<string, unknown> | null)?.description as string | null) ?? null,
      sourceFilePath: ((material as Record<string, unknown> | null)?.source_file_path as string | null) ?? null,
      organizationName: targetOrgId ? (orgNames.get(targetOrgId) ?? "Noma'lum tashkilot") : "Noma'lum tashkilot",
      requestedByTeacherName: ((requester as Record<string, unknown> | null)?.display_name as string) ?? "Noma'lum",
      requestedByTeacherEmail: authUserId ? (authEmails.get(authUserId) ?? "Noma'lum") : "Noma'lum",
      submittedAt: approval.created_at as string,
    };
  });
});

export const listAdminPendingOrganizationApprovals = cache(
  async (): Promise<AdminPendingOrganizationApprovalSummary[]> => {
    const supabase = createServerClient();
    const authEmails = await getAuthUserEmails();

    const { data, error } = await supabase
      .from("organizations")
      .select(
        `
        id,
        name,
        slug,
        created_at,
        platform_users!organizations_created_by_platform_user_id_fkey(
          id,
          auth_user_id,
          display_name
        )
      `,
      )
      .eq("status", "pending")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return ((data as Array<Record<string, unknown>> | null) ?? []).map((organization) => {
      const requester = Array.isArray(organization.platform_users) ? organization.platform_users[0] : organization.platform_users;
      const authUserId = ((requester as Record<string, unknown> | null)?.auth_user_id as string | undefined) ?? null;

      return {
        organizationId: organization.id as string,
        organizationName: organization.name as string,
        slug: organization.slug as string,
        type: "school",
        description: null,
        requestedByTeacherName: ((requester as Record<string, unknown> | null)?.display_name as string) ?? "Noma'lum",
        requestedByTeacherEmail: authUserId ? (authEmails.get(authUserId) ?? "Noma'lum") : "Noma'lum",
        requestedAt: organization.created_at as string,
      };
    });
  },
);

export const listAdminPendingTestApprovals = cache(async (): Promise<AdminPendingTestApprovalSummary[]> => {
  const supabase = createServerClient();
  const authEmails = await getAuthUserEmails();

  const { data, error } = await supabase
    .from("test_approvals")
    .select(
      `
      id,
      test_id,
      decision,
      requested_by_platform_user_id,
      reviewed_by_platform_user_id,
      decision_reason,
      is_reapproval,
      previous_questions_json,
      reviewed_at,
      created_at,
      updated_at,
      tests!inner(
        id,
        title,
        description,
        scope_type,
        origin,
        owner_teacher_id,
        owner_organization_id,
        status,
        test_questions!left(
          id,
          order_index,
          question_type,
          prompt,
          options_json,
          answer_json,
          explanation,
          images
        )
      ),
      platform_users!test_approvals_requested_by_platform_user_id_fkey(
        id,
        auth_user_id,
        display_name
      )
    `,
    )
    .eq("decision", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data as Array<Record<string, unknown>> | null) ?? []).map((approval) => {
    const test = Array.isArray(approval.tests) ? approval.tests[0] : approval.tests;
    const requester = Array.isArray(approval.platform_users) ? approval.platform_users[0] : approval.platform_users;
    const authUserId = ((requester as Record<string, unknown> | null)?.auth_user_id as string | undefined) ?? null;
    const rawQuestions = (((test as Record<string, unknown> | null)?.test_questions as Array<Record<string, unknown>> | undefined) ?? [])
      .sort((left, right) => ((left.order_index as number) ?? 0) - ((right.order_index as number) ?? 0));

    return {
      approvalId: approval.id as string,
      testId: approval.test_id as string,
      title: ((test as Record<string, unknown> | null)?.title as string) ?? "Nomsiz",
      description: ((test as Record<string, unknown> | null)?.description as string | null) ?? null,
      scopeType: ((test as Record<string, unknown> | null)?.scope_type as string) ?? "personal",
      origin: ((test as Record<string, unknown> | null)?.origin as string) ?? "manual",
      ownerTeacherId: ((test as Record<string, unknown> | null)?.owner_teacher_id as string) ?? "",
      ownerOrganizationId: ((test as Record<string, unknown> | null)?.owner_organization_id as string | null) ?? null,
      testStatus: ((test as Record<string, unknown> | null)?.status as string) ?? "unknown",
      decision: (approval.decision as string) ?? "pending",
      questions: rawQuestions.map((question) => ({
        questionId: question.id as string,
        questionType: (question.question_type as string) ?? "unknown",
        prompt: (question.prompt as string) ?? "",
        optionsJson: (question.options_json as Record<string, unknown> | null) ?? null,
        answerJson: (question.answer_json as Record<string, unknown> | null) ?? null,
        explanation: (question.explanation as string | null) ?? null,
        images: (question.images as string[]) ?? [],
      })),
      isReapproval: Boolean(approval.is_reapproval),
      previousQuestions: approval.previous_questions_json ? parsePreviousQuestions(approval.previous_questions_json) : null,
      requestedBy: requester
        ? {
            userId: ((requester as Record<string, unknown>).id as string) ?? "",
            email: authUserId ? (authEmails.get(authUserId) ?? "Noma'lum") : "Noma'lum",
            displayName: ((requester as Record<string, unknown>).display_name as string) ?? "Noma'lum",
          }
        : null,
      requestedAt: approval.created_at as string,
      reviewedBy: (approval.reviewed_by_platform_user_id as string | null) ?? null,
      reviewedAt: (approval.reviewed_at as string | null) ?? null,
      rejectionReason: (approval.decision_reason as string | null) ?? null,
      createdAt: approval.created_at as string,
      updatedAt: approval.updated_at as string,
    };
  });
});

export const listAdminPendingTestDeletionRequests = cache(
  async (): Promise<AdminPendingTestDeletionRequestSummary[]> => {
    const supabase = createServerClient();
    const authEmails = await getAuthUserEmails();

    const { data, error } = await supabase
      .from("test_deletion_requests")
      .select(
        `
        id,
        test_id,
        decision,
        reason,
        requested_by_platform_user_id,
        reviewed_by_platform_user_id,
        review_reason,
        reviewed_at,
        created_at,
        tests!inner(
          id,
          title,
          description,
          scope_type,
          owner_teacher_id,
          test_questions(id)
        ),
        platform_users!test_deletion_requests_requested_by_platform_user_id_fkey(
          id,
          auth_user_id,
          display_name
        )
      `,
      )
      .eq("decision", "pending")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return ((data as Array<Record<string, unknown>> | null) ?? []).map((request) => {
      const test = Array.isArray(request.tests) ? request.tests[0] : request.tests;
      const requester = Array.isArray(request.platform_users) ? request.platform_users[0] : request.platform_users;
      const authUserId = ((requester as Record<string, unknown> | null)?.auth_user_id as string | undefined) ?? null;
      const questions = (((test as Record<string, unknown> | null)?.test_questions as Array<Record<string, unknown>> | undefined) ?? []);

      return {
        requestId: request.id as string,
        testId: request.test_id as string,
        title: ((test as Record<string, unknown> | null)?.title as string) ?? "Nomsiz",
        description: ((test as Record<string, unknown> | null)?.description as string | null) ?? null,
        scopeType: ((test as Record<string, unknown> | null)?.scope_type as string) ?? "personal",
        ownerTeacherId: ((test as Record<string, unknown> | null)?.owner_teacher_id as string) ?? "",
        reason: (request.reason as string | null) ?? null,
        decision: (request.decision as string) ?? "pending",
        questionCount: questions.length,
        requestedBy: requester
          ? {
              userId: ((requester as Record<string, unknown>).id as string) ?? "",
email: authUserId ? (authEmails.get(authUserId) ?? "Noma'lum") : "Noma'lum",
            displayName: ((requester as Record<string, unknown>).display_name as string) ?? "Noma'lum",
            }
          : null,
        requestedAt: request.created_at as string,
        reviewedBy: (request.reviewed_by_platform_user_id as string | null) ?? null,
        reviewedAt: (request.reviewed_at as string | null) ?? null,
        reviewReason: (request.review_reason as string | null) ?? null,
      };
    });
  },
);
