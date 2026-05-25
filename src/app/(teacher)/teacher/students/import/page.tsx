import { requireAreaAccess } from "@/lib/auth/guards";
import { getTeacherSelectedOrganization } from "@/modules/teachers/server-data";
import { StudentImportClient } from "./student-import-client";

export default async function StudentImportPage() {
  const session = await requireAreaAccess("teacher");
  let selectedOrganization: {
    id: string;
    name: string;
    organizationName: string;
    organizationSlug: string;
  } | null = null;

  try {
    const selected = await getTeacherSelectedOrganization(session.userId);
    selectedOrganization = selected.organizationId
      ? {
          id: selected.organizationId,
          name: selected.organizationName ?? "",
          organizationName: selected.organizationName ?? "",
          organizationSlug: selected.organizationSlug ?? "",
        }
      : null;
  } catch {
    selectedOrganization = null;
  }

  return <StudentImportClient selectedOrganization={selectedOrganization} />;
}
