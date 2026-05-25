import { cache } from "react";

import { buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

const PAGE_SIZE = 20;

type StudentPaginationMeta = ReturnType<typeof buildPaginationMeta>;

export type StudentPaginatedResult<T> = {
  data: T[];
  meta: {
    pagination: StudentPaginationMeta;
  };
};

export type StudentClassSummary = {
  enrollmentId: string;
  classId: string;
  title: string;
  description: string | null;
  status: "active" | "inactive" | "left" | "archived";
  joinedAt: string;
  leftAt: string | null;
  source: string;
};

export type StudentAssignmentSummary = {
  assignmentResultId: string;
  status: "not_started" | "in_progress" | "submitted" | "reviewed" | "released";
  classId: string;
  classTitle: string;
  assignmentTemplateId: string;
  assignmentTitle: string;
  assignmentDescription: string | null;
  hasPractice: boolean;
  hasTest: boolean;
  deadline: string | null;
  publishedAt: string | null;
  practiceStartedAt: string | null;
  practiceSubmittedAt: string | null;
  testStartedAt: string | null;
  testSubmittedAt: string | null;
  releasedAt: string | null;
};

export type StudentGradeInfo = {
  mappedGrade: string | null;
  practiceScore: number | null;
  testScore: number | null;
  finalScore: number | null;
  isOverridden: boolean;
};

export type StudentResultSummary = {
  assignmentResultId: string;
  status: string;
  releasedAt: string;
  classId: string | null;
  classTitle: string | null;
  assignmentTemplateId: string | null;
  assignmentTitle: string | null;
  assignmentDescription: string | null;
  grade: StudentGradeInfo | null;
};

export type StudentNotificationSummary = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type StudentProfileSummary = {
  id: string;
  studentLogin: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  displayName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type StudentClassTeacher = {
  id: string;
  userId: string;
  displayName: string;
  role: string;
  isPrimary: boolean;
};

export type StudentClassDetail = {
  enrollmentId: string;
  classId: string;
  title: string;
  description: string | null;
  status: "active" | "left" | "suspended";
  classStatus: string;
  organizationId: string;
  joinedAt: string;
  leftAt: string | null;
  source: string;
  teachers: StudentClassTeacher[];
};

export type StudentClassMaterialSummary = {
  materialId: string;
  title: string;
  description: string | null;
  isAvailable: boolean;
  addedAt: string;
};

export type StudentResultDetail = {
  assignmentResultId: string;
  status: string;
  classId: string;
  classTitle: string;
  classDescription?: string;
  assignmentTemplateId: string;
  assignmentTitle: string;
  assignmentDescription?: string;
  hasPractice: boolean;
  hasTest: boolean;
  releasedAt: string | null;
  practiceStartedAt: string | null;
  practiceSubmittedAt: string | null;
  testStartedAt: string | null;
  testSubmittedAt: string | null;
  grade: {
    mappedGrade: string;
    practiceScore: number | null;
    testScore: number | null;
    finalScore: number;
    isOverridden: boolean;
    overrideReason: string | null;
    formulaSnapshot: {
      practiceWeight: number;
      testWeight: number;
    };
  } | null;
  testAttempts: Array<{
    id: string;
    attemptNumber: number;
    scoreRaw: number;
    submittedAt: string;
  }>;
};

export type StudentReviewDetail = {
  assignmentResultId: string;
  status: string;
  releasedAt: string | null;
  assignment: {
    templateId?: string | null;
    title?: string | null;
    description?: string | null;
  };
  review: {
    reviewId: string;
    status: string;
    releasedAt: string | null;
    reviewedAt: string | null;
    createdAt: string;
    updatedAt: string;
    teacherFeedback: string | null;
    teacherSummary: string | null;
    reviewMetadata: {
      rubricSnapshot: unknown;
      criteriaScores: unknown;
    };
  } | null;
  comments: Array<{
    commentId: string;
    authorType: string;
    parentCommentId: string | null;
    body: string;
    createdAt: string;
    updatedAt: string;
  }>;
  annotations: Array<{
    annotationId: string;
    derivedAssetId: string;
    pageIndex: number;
    version: number;
    isCurrent: boolean;
    baseWidth: number;
    baseHeight: number;
    payloadJson: unknown;
    createdAt: string;
  }>;
  grade: {
    mappedGrade: string;
    practiceScore: number | null;
    testScore: number | null;
    finalScore: number;
    isOverridden: boolean;
    overrideReason: string | null;
    formulaSnapshot: Record<string, unknown> | null;
  } | null;
};

export type StudentSubmissionFile = {
  id: string;
  fileRole: string;
  fileKind: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  sortOrder: number;
  createdAt: string;
};

export type StudentTestAttempt = {
  id: string;
  testId: string;
  attemptNumber: number;
  isCurrent: boolean;
  scoreRaw: number | null;
  startedAt: string | null;
  submittedAt: string | null;
};

export type StudentAssignmentDetail = {
  assignmentResultId: string;
  status: "not_started" | "in_progress" | "submitted" | "reviewed" | "released";
  classId: string;
  classTitle: string;
  classDescription: string | null;
  assignmentTemplateId: string;
  assignmentTitle: string;
  assignmentDescription: string | null;
  hasPractice: boolean;
  hasTest: boolean;
  linkedTestId: string | null;
  deadline: string | null;
  publishedAt: string | null;
  practiceStartedAt: string | null;
  practiceSubmittedAt: string | null;
  testStartedAt: string | null;
  testSubmittedAt: string | null;
  releasedAt: string | null;
  submissionFiles: StudentSubmissionFile[];
  testAttempts: StudentTestAttempt[];
  gradeRecord: StudentGradeInfo | null;
  linkedMaterials: Array<{
    id: string;
    title: string;
    description: string | null;
    sourceFilePath: string;
  }>;
};

function resolvePagination(options?: { page?: number; pageSize?: number }) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? PAGE_SIZE;
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

function toPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): StudentPaginatedResult<T> {
  return {
    data,
    meta: {
      pagination: buildPaginationMeta(page, pageSize, total),
    },
  };
}

function toFormulaSnapshot(value: unknown) {
  const snapshot = (value ?? null) as Record<string, unknown> | null;
  const practiceWeight = snapshot?.practiceWeight;
  const testWeight = snapshot?.testWeight;

  return {
    practiceWeight: typeof practiceWeight === "number" ? practiceWeight : 0.5,
    testWeight: typeof testWeight === "number" ? testWeight : 0.5,
  };
}

const listStudentClassesCached = cache(
  async (
    userId: string,
    status: "active" | "inactive" | "left" | "archived" | undefined,
    page: number,
    pageSize: number,
  ): Promise<StudentPaginatedResult<StudentClassSummary>> => {
    const supabase = createServerClient();
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("class_enrollments")
      .select(
        `
        id,
        status,
        joined_at,
        left_at,
        source,
        classes!inner(
          id,
          title,
          description,
          status,
          organization_id
        )
      `,
        { count: "exact" },
      )
      .eq("student_profile_id", userId)
      .is("deleted_at", null)
      .is("classes.deleted_at", null);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query
      .order("joined_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw error;
    }

    const classes = (data ?? []).map((enrollment: Record<string, unknown>) => {
      const classData = enrollment.classes as unknown as Record<string, unknown> | null;

      return {
        enrollmentId: enrollment.id as string,
        classId: classData?.id as string,
        title: classData?.title as string,
        description: (classData?.description as string | null | undefined) ?? null,
        status: enrollment.status as StudentClassSummary["status"],
        joinedAt: enrollment.joined_at as string,
        leftAt: (enrollment.left_at as string | null | undefined) ?? null,
        source: enrollment.source as string,
      };
    });

    return toPaginatedResult(classes, count ?? 0, page, pageSize);
  },
);

export async function listStudentClasses(
  userId: string,
  options?: {
    status?: "active" | "inactive" | "left" | "archived";
    page?: number;
    pageSize?: number;
  },
): Promise<StudentPaginatedResult<StudentClassSummary>> {
  const { page, pageSize } = resolvePagination(options);
  return listStudentClassesCached(userId, options?.status, page, pageSize);
}

const listStudentAssignmentsCached = cache(
  async (
    userId: string,
    status: StudentAssignmentSummary["status"] | undefined,
    classId: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<StudentPaginatedResult<StudentAssignmentSummary>> => {
    const supabase = createServerClient();
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("assignment_results")
      .select(
        `
        id,
        status,
        practice_started_at,
        practice_submitted_at,
        test_started_at,
        test_submitted_at,
        released_at,
        created_at,
        assignment_publication_classes!inner(
          id,
          deadline_override,
          class_id,
          classes!inner(
            id,
            title
          ),
          assignment_publications!inner(
            id,
            default_deadline,
            published_at,
            assignment_templates!inner(
              id,
              title,
              description,
              has_practice,
              has_test
            )
          )
        ),
        class_enrollments!inner(
          id,
          student_profile_id
        )
      `,
        { count: "exact" },
      )
      .eq("class_enrollments.student_profile_id", userId)
      .is("deleted_at", null)
      .is("assignment_publication_classes.deleted_at", null)
      .is("assignment_publication_classes.classes.deleted_at", null)
      .is("assignment_publication_classes.assignment_publications.deleted_at", null)
      .is("assignment_publication_classes.assignment_publications.assignment_templates.deleted_at", null);

    if (status) {
      query = query.eq("status", status);
    }

    if (classId) {
      query = query.eq("assignment_publication_classes.class_id", classId);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw error;
    }

    const assignments = (data ?? []).map((result: Record<string, unknown>) => {
      const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
      const classData = pubClass?.classes as unknown as Record<string, unknown> | null;
      const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
      const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;
      const deadline =
        (pubClass?.deadline_override as string | null | undefined) ??
        (publication?.default_deadline as string | null | undefined) ??
        null;

      return {
        assignmentResultId: result.id as string,
        status: result.status as StudentAssignmentSummary["status"],
        classId: classData?.id as string,
        classTitle: classData?.title as string,
        assignmentTemplateId: template?.id as string,
        assignmentTitle: template?.title as string,
        assignmentDescription: (template?.description as string | null | undefined) ?? null,
        hasPractice: Boolean(template?.has_practice),
        hasTest: Boolean(template?.has_test),
        deadline,
        publishedAt: (publication?.published_at as string | null | undefined) ?? null,
        practiceStartedAt: (result.practice_started_at as string | null | undefined) ?? null,
        practiceSubmittedAt: (result.practice_submitted_at as string | null | undefined) ?? null,
        testStartedAt: (result.test_started_at as string | null | undefined) ?? null,
        testSubmittedAt: (result.test_submitted_at as string | null | undefined) ?? null,
        releasedAt: (result.released_at as string | null | undefined) ?? null,
      };
    });

    return toPaginatedResult(assignments, count ?? 0, page, pageSize);
  },
);

export async function listStudentAssignments(
  userId: string,
  options?: {
    status?: StudentAssignmentSummary["status"];
    classId?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<StudentPaginatedResult<StudentAssignmentSummary>> {
  const { page, pageSize } = resolvePagination(options);
  return listStudentAssignmentsCached(userId, options?.status, options?.classId, page, pageSize);
}

const listStudentAssignmentsForClassCached = cache(
  async (userId: string, classId: string): Promise<StudentAssignmentSummary[]> => {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("assignment_results")
      .select(
        `
        id,
        status,
        practice_started_at,
        practice_submitted_at,
        test_started_at,
        test_submitted_at,
        released_at,
        created_at,
        assignment_publication_classes!inner(
          id,
          deadline_override,
          class_id,
          classes!inner(
            id,
            title
          ),
          assignment_publications!inner(
            id,
            default_deadline,
            published_at,
            assignment_templates!inner(
              id,
              title,
              description,
              has_practice,
              has_test
            )
          )
        ),
        class_enrollments!inner(
          id,
          student_profile_id
        )
      `,
      )
      .eq("class_enrollments.student_profile_id", userId)
      .eq("assignment_publication_classes.class_id", classId)
      .is("deleted_at", null)
      .is("assignment_publication_classes.deleted_at", null)
      .is("assignment_publication_classes.classes.deleted_at", null)
      .is("assignment_publication_classes.assignment_publications.deleted_at", null)
      .is("assignment_publication_classes.assignment_publications.assignment_templates.deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map((result: Record<string, unknown>) => {
      const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
      const classData = pubClass?.classes as unknown as Record<string, unknown> | null;
      const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
      const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;
      const deadline =
        (pubClass?.deadline_override as string | null | undefined) ??
        (publication?.default_deadline as string | null | undefined) ??
        null;

      return {
        assignmentResultId: result.id as string,
        status: result.status as StudentAssignmentSummary["status"],
        classId: classData?.id as string,
        classTitle: classData?.title as string,
        assignmentTemplateId: template?.id as string,
        assignmentTitle: template?.title as string,
        assignmentDescription: (template?.description as string | null | undefined) ?? null,
        hasPractice: Boolean(template?.has_practice),
        hasTest: Boolean(template?.has_test),
        deadline,
        publishedAt: (publication?.published_at as string | null | undefined) ?? null,
        practiceStartedAt: (result.practice_started_at as string | null | undefined) ?? null,
        practiceSubmittedAt: (result.practice_submitted_at as string | null | undefined) ?? null,
        testStartedAt: (result.test_started_at as string | null | undefined) ?? null,
        testSubmittedAt: (result.test_submitted_at as string | null | undefined) ?? null,
        releasedAt: (result.released_at as string | null | undefined) ?? null,
      };
    });
  },
);

export async function listStudentAssignmentsForClass(
  userId: string,
  classId: string,
): Promise<StudentAssignmentSummary[]> {
  return listStudentAssignmentsForClassCached(userId, classId);
}

const listStudentResultsCached = cache(
  async (
    userId: string,
    classId: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<StudentPaginatedResult<StudentResultSummary>> => {
    const supabase = createServerClient();
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("assignment_results")
      .select(
        `
        id,
        status,
        released_at,
        assignment_publication_classes!inner(
          class_id,
          classes!inner(
            id,
            title
          ),
          assignment_publications!inner(
            id,
            published_at,
            assignment_templates!inner(
              id,
              title,
              description
            )
          )
        ),
        class_enrollments!inner(
          student_profile_id
        ),
        grade_records!left(
          id,
          status,
          deleted_at,
          mapped_grade,
          practice_score_raw,
          test_score_raw,
          final_score_raw,
          is_overridden
        )
      `,
        { count: "exact" },
      )
      .eq("class_enrollments.student_profile_id", userId)
      .eq("status", "released")
      .is("deleted_at", null)
      .is("assignment_publication_classes.deleted_at", null)
      .is("assignment_publication_classes.classes.deleted_at", null)
      .is("assignment_publication_classes.assignment_publications.deleted_at", null)
      .is("assignment_publication_classes.assignment_publications.assignment_templates.deleted_at", null);

    if (classId) {
      query = query.eq("assignment_publication_classes.class_id", classId);
    }

    const { data, error, count } = await query
      .order("released_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw error;
    }

    const results = (data ?? []).map((result: Record<string, unknown>) => {
      const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
      const classData = pubClass?.classes as unknown as Record<string, unknown> | null;
      const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
      const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;
      const grades = ((result.grade_records as Array<Record<string, unknown>> | undefined) ?? []).find(
        (grade) => grade.status === "current" && grade.deleted_at == null,
      );

      return {
        assignmentResultId: result.id as string,
        status: result.status as string,
        releasedAt: result.released_at as string,
        classId: (classData?.id as string | null | undefined) ?? null,
        classTitle: (classData?.title as string | null | undefined) ?? null,
        assignmentTemplateId: (template?.id as string | null | undefined) ?? null,
        assignmentTitle: (template?.title as string | null | undefined) ?? null,
        assignmentDescription: (template?.description as string | null | undefined) ?? null,
        grade: grades
          ? {
              mappedGrade: (grades.mapped_grade as string | null | undefined) ?? null,
              practiceScore: (grades.practice_score_raw as number | null | undefined) ?? null,
              testScore: (grades.test_score_raw as number | null | undefined) ?? null,
              finalScore: (grades.final_score_raw as number | null | undefined) ?? null,
              isOverridden: Boolean(grades.is_overridden),
            }
          : null,
      };
    });

    return toPaginatedResult(results, count ?? 0, page, pageSize);
  },
);

export async function listStudentResults(
  userId: string,
  options?: {
    classId?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<StudentPaginatedResult<StudentResultSummary>> {
  const { page, pageSize } = resolvePagination(options);
  return listStudentResultsCached(userId, options?.classId, page, pageSize);
}

const listStudentNotificationsCached = cache(
  async (
    userId: string,
    read: "true" | "false" | undefined,
    type: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<StudentPaginatedResult<StudentNotificationSummary>> => {
    const supabase = createServerClient();
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("notifications")
      .select(
        `
        id,
        recipient_type,
        type,
        payload_json,
        read_at,
        created_at
      `,
        { count: "exact" },
      )
      .eq("recipient_student_profile_id", userId)
      .eq("recipient_type", "student_profile");

    if (read === "true") {
      query = query.not("read_at", "is", null);
    } else if (read === "false") {
      query = query.is("read_at", null);
    }

    if (type) {
      query = query.eq("type", type);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw error;
    }

    const notifications = (data ?? []).map((notification: Record<string, unknown>) => ({
      id: notification.id as string,
      type: notification.type as string,
      payload: (notification.payload_json as Record<string, unknown> | null | undefined) ?? {},
      isRead: notification.read_at !== null,
      readAt: (notification.read_at as string | null | undefined) ?? null,
      createdAt: notification.created_at as string,
    }));

    return toPaginatedResult(notifications, count ?? 0, page, pageSize);
  },
);

export async function listStudentNotifications(
  userId: string,
  options?: {
    read?: "true" | "false";
    type?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<StudentPaginatedResult<StudentNotificationSummary>> {
  const { page, pageSize } = resolvePagination(options);
  return listStudentNotificationsCached(userId, options?.read, options?.type, page, pageSize);
}

const getStudentProfileCached = cache(async (userId: string): Promise<StudentProfileSummary | null> => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("student_profiles")
    .select(
      `
      id,
      student_login,
      first_name,
      last_name,
      middle_name,
      display_name,
      status,
      created_at,
      updated_at
    `,
    )
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id as string,
    studentLogin: data.student_login as string,
    firstName: data.first_name as string,
    lastName: data.last_name as string,
    middleName: (data.middle_name as string | null | undefined) ?? null,
    displayName: data.display_name as string,
    status: data.status as string,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
});

export async function getStudentProfile(userId: string): Promise<StudentProfileSummary | null> {
  return getStudentProfileCached(userId);
}

const getStudentClassDetailCached = cache(
  async (userId: string, classId: string): Promise<StudentClassDetail | null> => {
    const supabase = createServerClient();
    const [enrollmentResult, teachersResult] = await Promise.all([
      supabase
        .from("class_enrollments")
        .select(
          `
          id,
          status,
          joined_at,
          left_at,
          source,
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
        .eq("student_profile_id", userId)
        .eq("class_id", classId)
        .is("deleted_at", null)
        .is("classes.deleted_at", null)
        .maybeSingle(),
      supabase
        .from("class_teachers")
        .select(
          `
          id,
          role,
          is_primary,
          platform_users!inner(
            id,
            display_name
          )
        `,
        )
        .eq("class_id", classId)
        .is("deleted_at", null)
        .eq("status", "active"),
    ]);

    if (enrollmentResult.error) {
      throw enrollmentResult.error;
    }

    if (!enrollmentResult.data) {
      return null;
    }

    if (teachersResult.error) {
      throw teachersResult.error;
    }

    const classData = enrollmentResult.data.classes as unknown as Record<string, unknown> | null;
    const teachers = (teachersResult.data ?? []).map((teacher: Record<string, unknown>) => {
      const user = teacher.platform_users as unknown as Record<string, unknown> | null;
      return {
        id: teacher.id as string,
        userId: user?.id as string,
        displayName: user?.display_name as string,
        role: teacher.role as string,
        isPrimary: Boolean(teacher.is_primary),
      };
    });

    return {
      enrollmentId: enrollmentResult.data.id as string,
      classId: classData?.id as string,
      title: classData?.title as string,
      description: (classData?.description as string | null | undefined) ?? null,
      status: enrollmentResult.data.status as StudentClassDetail["status"],
      classStatus: classData?.status as string,
      organizationId: classData?.organization_id as string,
      joinedAt: enrollmentResult.data.joined_at as string,
      leftAt: (enrollmentResult.data.left_at as string | null | undefined) ?? null,
      source: enrollmentResult.data.source as string,
      teachers,
    };
  },
);

export async function getStudentClassDetail(
  userId: string,
  classId: string,
): Promise<StudentClassDetail | null> {
  return getStudentClassDetailCached(userId, classId);
}

const listStudentClassMaterialsCached = cache(
  async (
    userId: string,
    classId: string,
    verifyEnrollment: boolean,
  ): Promise<StudentClassMaterialSummary[]> => {
    const supabase = createServerClient();

    if (verifyEnrollment) {
      const { data: enrollment, error: enrollmentError } = await supabase
        .from("class_enrollments")
        .select("id")
        .eq("student_profile_id", userId)
        .eq("class_id", classId)
        .is("deleted_at", null)
        .maybeSingle();

      if (enrollmentError) {
        throw enrollmentError;
      }

      if (!enrollment) {
        return [];
      }
    }

    const { data, error } = await supabase
      .from("class_materials")
      .select(
        `
        id,
        added_at,
        materials(
          id,
          title,
          description,
          deleted_at
        )
      `,
      )
      .eq("class_id", classId)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    return (data ?? []).map((classMaterial: Record<string, unknown>) => {
      const material = classMaterial.materials as unknown as Record<string, unknown> | null;

      return {
        materialId: material?.id as string,
        title: material?.title as string,
        description: (material?.description as string | null | undefined) ?? null,
        isAvailable: material?.deleted_at === null,
        addedAt: classMaterial.added_at as string,
      };
    });
  },
);

export async function listStudentClassMaterials(
  userId: string,
  classId: string,
  options?: { verifyEnrollment?: boolean },
): Promise<StudentClassMaterialSummary[]> {
  return listStudentClassMaterialsCached(userId, classId, options?.verifyEnrollment !== false);
}

const getStudentResultDetailCached = cache(
  async (userId: string, assignmentResultId: string): Promise<StudentResultDetail | null> => {
    const supabase = createServerClient();
    const { data: result, error: resultError } = await supabase
      .from("assignment_results")
      .select(
        `
        id,
        status,
        practice_started_at,
        practice_submitted_at,
        test_started_at,
        test_submitted_at,
        released_at,
        created_at,
        assignment_publication_classes!inner(
          class_id,
          classes!inner(
            id,
            title,
            description
          ),
          assignment_publications!inner(
            id,
            published_at,
            assignment_templates!inner(
              id,
              title,
              description,
              has_practice,
              has_test
            )
          )
        ),
        class_enrollments!inner(
          student_profile_id
        )
      `,
      )
      .eq("id", assignmentResultId)
      .eq("class_enrollments.student_profile_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (resultError) {
      throw resultError;
    }

    if (!result || result.status !== "released") {
      return null;
    }

    const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
    const classData = pubClass?.classes as unknown as Record<string, unknown> | null;
    const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
    const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;

    const [gradeResult, attemptsResult] = await Promise.all([
      supabase
        .from("grade_records")
        .select(
          `
          id,
          mapped_grade,
          practice_score_raw,
          test_score_raw,
          final_score_raw,
          is_overridden,
          override_reason,
          formula_snapshot_json
        `,
        )
        .eq("assignment_result_id", assignmentResultId)
        .eq("status", "current")
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("test_attempts")
        .select(
          `
          id,
          attempt_number,
          score_raw,
          submitted_at
        `,
        )
        .eq("assignment_result_id", assignmentResultId)
        .is("deleted_at", null)
        .order("attempt_number", { ascending: true }),
    ]);

    if (gradeResult.error) {
      throw gradeResult.error;
    }

    if (attemptsResult.error) {
      throw attemptsResult.error;
    }

    return {
      assignmentResultId: result.id as string,
      status: result.status as string,
      classId: classData?.id as string,
      classTitle: classData?.title as string,
      classDescription: (classData?.description as string | undefined) ?? undefined,
      assignmentTemplateId: template?.id as string,
      assignmentTitle: template?.title as string,
      assignmentDescription: (template?.description as string | undefined) ?? undefined,
      hasPractice: Boolean(template?.has_practice),
      hasTest: Boolean(template?.has_test),
      releasedAt: (result.released_at as string | null | undefined) ?? null,
      practiceStartedAt: (result.practice_started_at as string | null | undefined) ?? null,
      practiceSubmittedAt: (result.practice_submitted_at as string | null | undefined) ?? null,
      testStartedAt: (result.test_started_at as string | null | undefined) ?? null,
      testSubmittedAt: (result.test_submitted_at as string | null | undefined) ?? null,
      grade: gradeResult.data
        ? {
            mappedGrade: gradeResult.data.mapped_grade as string,
            practiceScore: (gradeResult.data.practice_score_raw as number | null | undefined) ?? null,
            testScore: (gradeResult.data.test_score_raw as number | null | undefined) ?? null,
            finalScore: gradeResult.data.final_score_raw as number,
            isOverridden: Boolean(gradeResult.data.is_overridden),
            overrideReason: (gradeResult.data.override_reason as string | null | undefined) ?? null,
            formulaSnapshot: toFormulaSnapshot(gradeResult.data.formula_snapshot_json),
          }
        : null,
      testAttempts: (attemptsResult.data ?? []).map((attempt: Record<string, unknown>) => ({
        id: attempt.id as string,
        attemptNumber: attempt.attempt_number as number,
        scoreRaw: attempt.score_raw as number,
        submittedAt: attempt.submitted_at as string,
      })),
    };
  },
);

export async function getStudentResultDetail(
  userId: string,
  assignmentResultId: string,
): Promise<StudentResultDetail | null> {
  return getStudentResultDetailCached(userId, assignmentResultId);
}

const getStudentReleasedReviewDetailCached = cache(
  async (userId: string, assignmentResultId: string): Promise<StudentReviewDetail | null> => {
    const supabase = createServerClient();
    const { data: result, error: resultError } = await supabase
      .from("assignment_results")
      .select(
        `
        id,
        status,
        released_at,
        assignment_publication_classes!inner(
          assignment_publications!inner(
            assignment_templates!inner(
              id,
              title,
              description
            )
          )
        ),
        class_enrollments!inner(
          student_profile_id
        )
      `,
      )
      .eq("id", assignmentResultId)
      .eq("class_enrollments.student_profile_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (resultError) {
      throw resultError;
    }

    if (!result || result.status !== "released") {
      return null;
    }

    const [reviewResult, gradeResult] = await Promise.all([
      supabase
        .from("submission_reviews")
        .select(
          `
          *,
          review_comments!left(
            id,
            author_type,
            parent_comment_id,
            body,
            is_internal,
            created_at,
            updated_at
          ),
          annotation_documents!left(
            id,
            derived_asset_id,
            page_index,
            version,
            is_current,
            base_width,
            base_height,
            payload_json,
            created_at,
            deleted_at
          )
        `,
        )
        .eq("assignment_result_id", assignmentResultId)
        .eq("status", "released")
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("grade_records")
        .select(
          `
          id,
          mapped_grade,
          practice_score_raw,
          test_score_raw,
          final_score_raw,
          is_overridden,
          override_reason,
          formula_snapshot_json
        `,
        )
        .eq("assignment_result_id", assignmentResultId)
        .eq("status", "current")
        .is("deleted_at", null)
        .maybeSingle(),
    ]);

    if (reviewResult.error) {
      throw reviewResult.error;
    }

    if (gradeResult.error) {
      throw gradeResult.error;
    }

    const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
    const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
    const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;
    const review = reviewResult.data as unknown as Record<string, unknown> | null;
    const comments = ((review?.review_comments as Array<Record<string, unknown>> | undefined) ?? []).filter(
      (comment) => comment.is_internal !== true,
    );
    const annotations = ((review?.annotation_documents as Array<Record<string, unknown>> | undefined) ?? []).filter(
      (annotation) => annotation.is_current === true && annotation.deleted_at == null,
    );

    return {
      assignmentResultId: result.id as string,
      status: result.status as string,
      releasedAt: (result.released_at as string | null | undefined) ?? null,
      assignment: {
        templateId: (template?.id as string | null | undefined) ?? null,
        title: (template?.title as string | null | undefined) ?? null,
        description: (template?.description as string | null | undefined) ?? null,
      },
      review: review
        ? {
            reviewId: review.id as string,
            status: review.status as string,
            releasedAt: (review.released_at as string | null | undefined) ?? null,
            reviewedAt:
              (review.reviewed_at as string | null | undefined) ??
              (review.updated_at as string | null | undefined) ??
              null,
            createdAt: review.created_at as string,
            updatedAt: review.updated_at as string,
            teacherFeedback:
              (review.teacher_feedback as string | null | undefined) ??
              (review.feedback as string | null | undefined) ??
              (review.overall_feedback as string | null | undefined) ??
              null,
            teacherSummary:
              (review.teacher_summary as string | null | undefined) ??
              (review.summary as string | null | undefined) ??
              null,
            reviewMetadata: {
              rubricSnapshot:
                (review.rubric_snapshot_json as unknown | undefined) ??
                (review.grade_breakdown_json as unknown | undefined) ??
                null,
              criteriaScores:
                (review.criteria_scores_json as unknown | undefined) ??
                (review.scores_json as unknown | undefined) ??
                null,
            },
          }
        : null,
      comments: comments.map((comment) => ({
        commentId: comment.id as string,
        authorType: comment.author_type as string,
        parentCommentId: (comment.parent_comment_id as string | null | undefined) ?? null,
        body: comment.body as string,
        createdAt: comment.created_at as string,
        updatedAt: comment.updated_at as string,
      })),
      annotations: annotations.map((annotation) => ({
        annotationId: annotation.id as string,
        derivedAssetId: annotation.derived_asset_id as string,
        pageIndex: annotation.page_index as number,
        version: annotation.version as number,
        isCurrent: Boolean(annotation.is_current),
        baseWidth: annotation.base_width as number,
        baseHeight: annotation.base_height as number,
        payloadJson: annotation.payload_json,
        createdAt: annotation.created_at as string,
      })),
      grade: gradeResult.data
        ? {
            mappedGrade: gradeResult.data.mapped_grade as string,
            practiceScore: (gradeResult.data.practice_score_raw as number | null | undefined) ?? null,
            testScore: (gradeResult.data.test_score_raw as number | null | undefined) ?? null,
            finalScore: gradeResult.data.final_score_raw as number,
            isOverridden: Boolean(gradeResult.data.is_overridden),
            overrideReason: (gradeResult.data.override_reason as string | null | undefined) ?? null,
            formulaSnapshot:
              (gradeResult.data.formula_snapshot_json as Record<string, unknown> | null | undefined) ?? null,
          }
        : null,
    };
  },
);

export async function getStudentReleasedReviewDetail(
  userId: string,
  assignmentResultId: string,
): Promise<StudentReviewDetail | null> {
  return getStudentReleasedReviewDetailCached(userId, assignmentResultId);
}

const getStudentAssignmentDetailCached = cache(
  async (userId: string, assignmentResultId: string): Promise<StudentAssignmentDetail | null> => {
    const supabase = createServerClient();
    const { data: result, error: resultError } = await supabase
      .from("assignment_results")
      .select(
        `
        id,
        status,
        practice_started_at,
        practice_submitted_at,
        test_started_at,
        test_submitted_at,
        released_at,
        created_at,
        updated_at,
        assignment_publication_classes!inner(
          id,
          deadline_override,
          class_id,
          classes!inner(
            id,
            title,
            description
          ),
          assignment_publications!inner(
            id,
            default_deadline,
            published_at,
            assignment_templates!inner(
              id,
              title,
              description,
              has_practice,
              has_test,
              linked_test_id
            )
          )
        ),
        class_enrollments!inner(
          id,
          student_profile_id
        )
      `,
      )
      .eq("id", assignmentResultId)
      .eq("class_enrollments.student_profile_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (resultError) {
      throw resultError;
    }

    if (!result) {
      return null;
    }

    const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
    const classData = pubClass?.classes as unknown as Record<string, unknown> | null;
    const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
    const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;
    const templateId = template?.id as string | undefined;
    const deadline =
      (pubClass?.deadline_override as string | null | undefined) ??
      (publication?.default_deadline as string | null | undefined) ??
      null;

    const filesPromise = supabase
      .from("submission_files")
      .select(
        `
        id,
        file_role,
        file_kind,
        original_filename,
        mime_type,
        file_size_bytes,
        sort_order,
        is_current,
        created_at
      `,
      )
      .eq("assignment_result_id", assignmentResultId)
      .eq("is_current", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    const attemptsPromise = supabase
      .from("test_attempts")
      .select(
        `
        id,
        test_id,
        attempt_number,
        is_current,
        score_raw,
        started_at,
        submitted_at
      `,
      )
      .eq("assignment_result_id", assignmentResultId)
      .is("deleted_at", null)
      .order("attempt_number", { ascending: false });

    const gradePromise =
      result.status === "released" && result.released_at
        ? supabase
            .from("grade_records")
            .select(
              `
              id,
              mapped_grade,
              practice_score_raw,
              test_score_raw,
              final_score_raw,
              is_overridden
            `,
            )
            .eq("assignment_result_id", assignmentResultId)
            .eq("status", "current")
            .is("deleted_at", null)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

    const materialsPromise = templateId
      ? supabase
          .from("assignment_template_materials")
          .select(
            `
            material_id,
            materials!inner(
              id,
              title,
              description,
              source_file_path
            )
          `,
          )
          .eq("assignment_template_id", templateId)
          .is("deleted_at", null)
          .eq("materials.status", "active")
          .is("materials.deleted_at", null)
      : Promise.resolve({ data: [], error: null });

    const [filesResult, attemptsResult, gradeResult, materialsResult] = await Promise.all([
      filesPromise,
      attemptsPromise,
      gradePromise,
      materialsPromise,
    ]);

    if (filesResult.error) {
      throw filesResult.error;
    }

    if (attemptsResult.error) {
      throw attemptsResult.error;
    }

    if (gradeResult.error) {
      throw gradeResult.error;
    }

    if (materialsResult.error) {
      throw materialsResult.error;
    }

    return {
      assignmentResultId: result.id as string,
      status: result.status as StudentAssignmentDetail["status"],
      classId: classData?.id as string,
      classTitle: classData?.title as string,
      classDescription: (classData?.description as string | null | undefined) ?? null,
      assignmentTemplateId: template?.id as string,
      assignmentTitle: template?.title as string,
      assignmentDescription: (template?.description as string | null | undefined) ?? null,
      hasPractice: Boolean(template?.has_practice),
      hasTest: Boolean(template?.has_test),
      linkedTestId: (template?.linked_test_id as string | null | undefined) ?? null,
      deadline,
      publishedAt: (publication?.published_at as string | null | undefined) ?? null,
      practiceStartedAt: (result.practice_started_at as string | null | undefined) ?? null,
      practiceSubmittedAt: (result.practice_submitted_at as string | null | undefined) ?? null,
      testStartedAt: (result.test_started_at as string | null | undefined) ?? null,
      testSubmittedAt: (result.test_submitted_at as string | null | undefined) ?? null,
      releasedAt: (result.released_at as string | null | undefined) ?? null,
      submissionFiles: (filesResult.data ?? []).map((file: Record<string, unknown>) => ({
        id: file.id as string,
        fileRole: file.file_role as string,
        fileKind: file.file_kind as string,
        originalFilename: file.original_filename as string,
        mimeType: file.mime_type as string,
        fileSizeBytes: file.file_size_bytes as number,
        sortOrder: file.sort_order as number,
        createdAt: file.created_at as string,
      })),
      testAttempts: (attemptsResult.data ?? []).map((attempt: Record<string, unknown>) => ({
        id: attempt.id as string,
        testId: attempt.test_id as string,
        attemptNumber: attempt.attempt_number as number,
        isCurrent: Boolean(attempt.is_current),
        scoreRaw: (attempt.score_raw as number | null | undefined) ?? null,
        startedAt: (attempt.started_at as string | null | undefined) ?? null,
        submittedAt: (attempt.submitted_at as string | null | undefined) ?? null,
      })),
      gradeRecord: gradeResult.data
        ? {
            mappedGrade: (gradeResult.data.mapped_grade as string | null | undefined) ?? null,
            practiceScore: (gradeResult.data.practice_score_raw as number | null | undefined) ?? null,
            testScore: (gradeResult.data.test_score_raw as number | null | undefined) ?? null,
            finalScore: (gradeResult.data.final_score_raw as number | null | undefined) ?? null,
            isOverridden: Boolean(gradeResult.data.is_overridden),
          }
        : null,
      linkedMaterials: (materialsResult.data ?? []).map((row: Record<string, unknown>) => {
        const material = row.materials as Record<string, unknown>;
        return {
          id: material.id as string,
          title: material.title as string,
          description: (material.description as string | null | undefined) ?? null,
          sourceFilePath: material.source_file_path as string,
        };
      }),
    };
  },
);

export async function getStudentAssignmentDetail(
  userId: string,
  assignmentResultId: string,
): Promise<StudentAssignmentDetail | null> {
  return getStudentAssignmentDetailCached(userId, assignmentResultId);
}
