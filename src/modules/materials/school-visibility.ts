import type { SupabaseClient } from "@supabase/supabase-js";

export type MaterialSchoolVisibilityMaterial = {
  id: string;
  status: string | null;
  deleted_at: string | null;
};

export type LatestMaterialApprovalForOrganization = {
  approvalId: string;
  materialId: string;
  organizationId: string;
  decision: string;
  createdAt: string;
  reviewedAt: string | null;
};

export type MaterialSchoolVisibilityState = {
  material: MaterialSchoolVisibilityMaterial | null;
  latestApproval: LatestMaterialApprovalForOrganization | null;
  isSchoolVisible: boolean;
};

function dedupeMaterialIds(materialIds: string[]) {
  return Array.from(new Set(materialIds.filter(Boolean)));
}

function buildInvisibleState(material: MaterialSchoolVisibilityMaterial | null = null): MaterialSchoolVisibilityState {
  return {
    material,
    latestApproval: null,
    isSchoolVisible: false,
  };
}

export function isMaterialSchoolVisibleForOrganization(input: {
  material: MaterialSchoolVisibilityMaterial | null | undefined;
  latestApproval: LatestMaterialApprovalForOrganization | null | undefined;
}) {
  return Boolean(
    input.material &&
      input.material.deleted_at === null &&
      input.material.status === "active" &&
      input.latestApproval?.decision === "approved",
  );
}

export async function getLatestMaterialApprovalsForOrganization(
  supabase: SupabaseClient,
  input: { materialIds: string[]; organizationId: string | null | undefined },
): Promise<Map<string, LatestMaterialApprovalForOrganization>> {
  const materialIds = dedupeMaterialIds(input.materialIds);

  if (!input.organizationId || materialIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("material_approvals")
    .select("id, material_id, organization_id, decision, created_at, reviewed_at")
    .in("material_id", materialIds)
    .eq("organization_id", input.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const approvals = new Map<string, LatestMaterialApprovalForOrganization>();

  for (const approval of data ?? []) {
    if (approvals.has(approval.material_id)) {
      continue;
    }

    approvals.set(approval.material_id, {
      approvalId: approval.id,
      materialId: approval.material_id,
      organizationId: approval.organization_id,
      decision: approval.decision,
      createdAt: approval.created_at,
      reviewedAt: approval.reviewed_at,
    });
  }

  return approvals;
}

export async function getLatestMaterialApprovalForOrganization(
  supabase: SupabaseClient,
  input: { materialId: string; organizationId: string | null | undefined },
): Promise<LatestMaterialApprovalForOrganization | null> {
  const approvals = await getLatestMaterialApprovalsForOrganization(supabase, {
    materialIds: [input.materialId],
    organizationId: input.organizationId,
  });

  return approvals.get(input.materialId) ?? null;
}

export async function getMaterialSchoolVisibilityStatesForOrganization(
  supabase: SupabaseClient,
  input: { materialIds: string[]; organizationId: string | null | undefined },
): Promise<Map<string, MaterialSchoolVisibilityState>> {
  const materialIds = dedupeMaterialIds(input.materialIds);
  const states = new Map<string, MaterialSchoolVisibilityState>(
    materialIds.map((materialId) => [materialId, buildInvisibleState()]),
  );

  if (materialIds.length === 0) {
    return states;
  }

  const [{ data: materials, error: materialsError }, latestApprovals] = await Promise.all([
    supabase
      .from("materials")
      .select("id, status, deleted_at")
      .in("id", materialIds),
    getLatestMaterialApprovalsForOrganization(supabase, input),
  ]);

  if (materialsError) {
    throw materialsError;
  }

  for (const material of materials ?? []) {
    const latestApproval = latestApprovals.get(material.id) ?? null;

    states.set(material.id, {
      material,
      latestApproval,
      isSchoolVisible: isMaterialSchoolVisibleForOrganization({
        material,
        latestApproval,
      }),
    });
  }

  return states;
}

export async function getMaterialSchoolVisibilityStateForOrganization(
  supabase: SupabaseClient,
  input: { materialId: string; organizationId: string | null | undefined },
): Promise<MaterialSchoolVisibilityState> {
  const states = await getMaterialSchoolVisibilityStatesForOrganization(supabase, {
    materialIds: [input.materialId],
    organizationId: input.organizationId,
  });

  return states.get(input.materialId) ?? buildInvisibleState();
}
