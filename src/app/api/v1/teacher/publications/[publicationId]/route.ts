/**
 * GET /api/v1/teacher/publications/[publicationId] — Get publication detail.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

// GET — Get publication detail
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const publicationId = params?.publicationId as string;

      if (!publicationId) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Publication ID is required."),
        );
      }

      const supabase = createServerClient();

      const { data: publication, error: pubError } = await supabase
        .from("assignment_publications")
        .select(
          `
          id,
          assignment_template_id,
          published_by_teacher_id,
          default_deadline,
          status,
          created_at,
          updated_at,
          assignment_templates!inner(
            id,
            title,
            description,
            linked_test_id
          )
        `
        )
        .eq("id", publicationId)
        .is("deleted_at", null)
        .single();

      if (pubError || !publication) {
        console.error("[teacher/publications/detail] Publication fetch error:", JSON.stringify(pubError));
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Publication not found."),
        );
      }

      const template = publication.assignment_templates as unknown as Record<string, unknown> | null;

      const { data: pubClasses, error: classesError } = await supabase
        .from("assignment_publication_classes")
        .select(
          `
          id,
          class_id,
          deadline_override,
          classes!inner(id, title, organization_id)
        `
        )
        .eq("assignment_publication_id", publicationId)
        .is("deleted_at", null);

      if (classesError) {
        console.error("[teacher/publications/detail] Error fetching classes:", classesError);
      }

      const allPublicationClasses = pubClasses ?? [];
      const allClassIds = allPublicationClasses.map((pc) => pc.class_id as string);
      const isPublisher = publication.published_by_teacher_id === session.userId;

      let accessibleClassIds = allClassIds;
      if (!isPublisher && allClassIds.length > 0) {
        const { data: classTeachers, error: accessError } = await supabase
          .from("class_teachers")
          .select("class_id")
          .eq("platform_user_id", session.userId)
          .eq("status", "active")
          .is("deleted_at", null)
          .in("class_id", allClassIds);

        if (accessError) {
          console.error("[teacher/publications/detail] Error verifying publication access:", accessError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify publication access."),
          );
        }

        accessibleClassIds = (classTeachers ?? []).map((row) => row.class_id as string);
      }

      if (!isPublisher && accessibleClassIds.length === 0) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Publication not found."),
        );
      }

      const visiblePublicationClasses = allPublicationClasses.filter((pc) =>
        accessibleClassIds.includes(pc.class_id as string),
      );

      // Get organization info from the first class
      let organizationId: string | null = null;
      let organizationName: string | null = null;
      const firstClass = visiblePublicationClasses[0] as Record<string, unknown> | undefined;
      const firstClassData = firstClass?.classes as unknown as Record<string, unknown> | null;
      if (firstClassData?.organization_id) {
        organizationId = firstClassData.organization_id as string;
        const { data: orgData } = await supabase
          .from("organizations")
          .select("id, name")
          .eq("id", organizationId)
          .is("deleted_at", null)
          .single();
        if (orgData) {
          organizationName = orgData.name;
        }
      }

      // Get class enrollments count for each class
      const classIds = visiblePublicationClasses.map((pc) => pc.class_id);
      let enrollmentCounts: Record<string, number> = {};
      let enrollmentIdsByClass: Record<string, string[]> = {};

      if (classIds.length > 0) {
        const { data: enrollments } = await supabase
          .from("class_enrollments")
          .select("id, class_id")
          .in("class_id", classIds)
          .eq("status", "active")
          .is("deleted_at", null);

        enrollmentCounts = (enrollments ?? []).reduce((acc, e) => {
          acc[e.class_id] = (acc[e.class_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Group enrollment IDs by class for stats calculation
        enrollmentIdsByClass = (enrollments ?? []).reduce((acc, e) => {
          if (!acc[e.class_id]) acc[e.class_id] = [];
          acc[e.class_id].push(e.id);
          return acc;
        }, {} as Record<string, string[]>);
      }

      // Get assignment results stats for each publication class
      const publicationClassIds = visiblePublicationClasses.map((pc) => pc.id);
      let resultsByPubClass: Record<string, Array<{ status: string; class_enrollment_id: string }>> = {};

      if (publicationClassIds.length > 0) {
        const { data: results } = await supabase
          .from("assignment_results")
          .select("assignment_publication_class_id, status, class_enrollment_id")
          .in("assignment_publication_class_id", publicationClassIds)
          .is("deleted_at", null);

        resultsByPubClass = (results ?? []).reduce((acc, r) => {
          if (!acc[r.assignment_publication_class_id]) acc[r.assignment_publication_class_id] = [];
          acc[r.assignment_publication_class_id].push({
            status: r.status,
            class_enrollment_id: r.class_enrollment_id,
          });
          return acc;
        }, {} as Record<string, Array<{ status: string; class_enrollment_id: string }>>);
      }

      // Get linked materials
      const { data: linkedMaterials, error: materialsError } = await supabase
        .from("assignment_template_materials")
        .select(
          `
          id,
          material_id,
          materials!inner(id, title, scope_type, owner_teacher_id)
        `
        )
        .eq("assignment_template_id", publication.assignment_template_id)
        .is("deleted_at", null);

      if (materialsError) {
        console.error("[teacher/publications/detail] Error fetching materials:", materialsError);
      }

      // Get linked test — assignment_templates has linked_test_id (single test), not a join table
      let linkedTestData: Array<{ id: string; title: string; questionCount: number; scopeType: string; ownerTeacherId: string | null }> = [];
      if (template?.linked_test_id) {
        const { data: testData, error: testError } = await supabase
          .from("tests")
          .select("id, title, scope_type, owner_teacher_id")
          .eq("id", template.linked_test_id as string)
          .is("deleted_at", null)
          .maybeSingle();

        if (testError) {
          console.error("[teacher/publications/detail] Error fetching linked test:", testError);
        }

        if (testData) {
          // Get question count for the test
          const { count: questionCount, error: countError } = await supabase
            .from("test_questions")
            .select("*", { count: "exact", head: true })
            .eq("test_id", testData.id)
            .is("deleted_at", null);

          linkedTestData = [{
            id: testData.id,
            title: testData.title,
            questionCount: questionCount ?? 0,
            scopeType: testData.scope_type,
            ownerTeacherId: typeof testData.owner_teacher_id === "string" ? testData.owner_teacher_id : null,
          }];
        }
      }

      // Transform class targets with real submission stats
      const classTargets = visiblePublicationClasses.map((pc) => {
        const classData = pc.classes as unknown as Record<string, unknown> | null;
        const classId = pc.class_id;
        const pubClassId = pc.id;
        const rosterCount = enrollmentCounts[classId] || 0;
        const classEnrollmentIds = enrollmentIdsByClass[classId] || [];
        const classResults = resultsByPubClass[pubClassId] || [];

        // Calculate real stats
        const submittedCount = classResults.filter(
          (r) => r.status === "submitted" || r.status === "reviewed" || r.status === "released"
        ).length;
        const reviewedCount = classResults.filter(
          (r) => r.status === "reviewed" || r.status === "released"
        ).length;
        const pendingCount = Math.max(0, rosterCount - submittedCount);
        const submissionRate = rosterCount > 0 ? Math.round((submittedCount / rosterCount) * 100) : 0;

        return {
          classId: classId,
          publicationClassId: pubClassId,
          className: classData?.title,
          classSlug: classData?.title ? (classData.title as string).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : null,
          rosterCount: rosterCount,
          defaultDeadline: publication.default_deadline,
          deadlineOverride: pc.deadline_override,
          effectiveDeadline: pc.deadline_override ?? publication.default_deadline,
          submissionStats: {
            submittedCount,
            reviewedCount,
            pendingCount,
            submissionRate,
          },
        };
      });

      // Transform linked materials
      const materials = (linkedMaterials ?? []).map((lm) => {
        const materialData = lm.materials as unknown as Record<string, unknown> | null;
        return {
          id: lm.material_id,
          title: materialData?.title,
          scopeType: materialData?.scope_type,
          ownerTeacherId: typeof materialData?.owner_teacher_id === "string" ? materialData.owner_teacher_id : null,
        };
      });

      // Get teacher names for materials and tests
      const ownerTeacherIds = [
        ...materials.map(m => m.ownerTeacherId).filter(Boolean),
        ...linkedTestData.map(t => t.ownerTeacherId).filter(Boolean),
      ] as string[];

      let teacherNameMap: Record<string, string> = {};
      if (ownerTeacherIds.length > 0) {
        const { data: teachers } = await supabase
          .from("platform_users")
          .select("id, first_name, last_name")
          .in("id", ownerTeacherIds);
        
        for (const t of teachers ?? []) {
          teacherNameMap[t.id] = `${t.first_name} ${t.last_name}`;
        }
      }

      // Add teacher names to materials
      const materialsWithNames = materials.map(m => ({
        ...m,
        ownerTeacherName: m.ownerTeacherId ? (teacherNameMap[m.ownerTeacherId] || "Unknown") : null,
      }));

      // Transform linked tests with teacher names
      const testsWithNames = linkedTestData.map(t => ({
        ...t,
        ownerTeacherName: t.ownerTeacherId ? (teacherNameMap[t.ownerTeacherId] || "Unknown") : null,
      }));

      const data = {
        id: publication.id,
        templateId: publication.assignment_template_id,
        title: template?.title,
        description: template?.description,
        organizationId: organizationId,
        organizationName: organizationName ?? "Unknown Organization",
        defaultDeadline: publication.default_deadline,
        status: publication.status,
        classTargets,
        linkedMaterials: materialsWithNames,
        linkedTests: testsWithNames,
        createdAt: publication.created_at,
        updatedAt: publication.updated_at,
      };

      return toResponse(successResponse(data));
    } catch (err) {
      console.error("[teacher/publications/detail] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch publication detail."),
      );
    }
  },
  { requiredRole: "teacher" },
);
