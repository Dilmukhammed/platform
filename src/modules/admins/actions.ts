import "server-only";

import { z } from "zod/v4";

import { requireAreaAccess } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server-client";
import { t } from "@/lib/translations";

const rejectionReasonSchema = z.string().min(1, t.api.adminActions.rejectionReasonRequired);

function getJoinedRecord(
  value: Record<string, unknown> | Array<Record<string, unknown>> | null | undefined,
) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function approveAdminMaterialApproval(approvalId: string) {
  const session = await requireAreaAccess("admin");
  const supabase = createServerClient();

  const { data: approval, error: fetchError } = await supabase
    .from("material_approvals")
    .select("id, material_id, decision, requested_by_platform_user_id, materials(id, title, status)")
    .eq("id", approvalId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !approval) {
    throw new Error(t.api.adminActions.materialApprovalRequestNotFound);
  }

  if (approval.decision !== "pending") {
    throw new Error(t.api.adminActions.materialApprovalAlready.replace("{decision}", approval.decision));
  }

  const { data: updatedApproval, error: updateError } = await supabase
    .from("material_approvals")
    .update({
      decision: "approved",
      reviewed_by_platform_user_id: session.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", approvalId)
    .eq("decision", "pending")
    .select("id, material_id, decision, reviewed_by_platform_user_id, reviewed_at, updated_at")
    .single();

  if (updateError) {
    throw new Error(t.api.adminActions.failedToApproveMaterial);
  }

  if (!updatedApproval) {
    throw new Error(t.api.adminActions.materialApprovalAlreadyProcessed);
  }

  const { error: materialUpdateError } = await supabase
    .from("materials")
    .update({ status: "active" })
    .eq("id", approval.material_id)
    .is("deleted_at", null);

  if (materialUpdateError) {
    throw new Error(t.api.adminActions.failedToActivateApprovedMaterial);
  }

  if (approval.requested_by_platform_user_id) {
    const material = getJoinedRecord(approval.materials);
    const { error: notifyError } = await supabase.from("notifications").insert({
      recipient_type: "platform_user",
      recipient_platform_user_id: approval.requested_by_platform_user_id,
      type: "material_approved",
      payload_json: {
        materialId: approval.material_id,
        materialTitle: material?.title ?? null,
        approvalId,
        message: t.notifications.payloads.materialApproved,
      },
    });

    if (notifyError) {
      console.error("[admins/actions] material approve notification error:", notifyError);
    }
  }

  return updatedApproval;
}

export async function rejectAdminMaterialApproval(approvalId: string, reason: string) {
  const parsedReason = rejectionReasonSchema.parse(reason);
  const session = await requireAreaAccess("admin");
  const supabase = createServerClient();

  const { data: approval, error: fetchError } = await supabase
    .from("material_approvals")
    .select("id, material_id, decision, requested_by_platform_user_id, materials(id, title, status)")
    .eq("id", approvalId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !approval) {
    throw new Error(t.api.adminActions.materialApprovalRequestNotFound);
  }

  if (approval.decision !== "pending") {
    throw new Error(t.api.adminActions.materialApprovalAlready.replace("{decision}", approval.decision));
  }

  const { data: updatedApproval, error: updateError } = await supabase
    .from("material_approvals")
    .update({
      decision: "rejected",
      decision_reason: parsedReason,
      reviewed_by_platform_user_id: session.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", approvalId)
    .eq("decision", "pending")
    .select("id, material_id, decision, decision_reason, reviewed_by_platform_user_id, reviewed_at, updated_at")
    .single();

  if (updateError) {
    throw new Error(t.api.adminActions.failedToRejectMaterial);
  }

  if (!updatedApproval) {
    throw new Error(t.api.adminActions.materialApprovalAlreadyProcessed);
  }

  const { error: materialUpdateError } = await supabase
    .from("materials")
    .update({ status: "draft" })
    .eq("id", approval.material_id)
    .is("deleted_at", null);

  if (materialUpdateError) {
    throw new Error(t.api.adminActions.failedToResetRejectedMaterial);
  }

  if (approval.requested_by_platform_user_id) {
    const material = getJoinedRecord(approval.materials);
    const { error: notifyError } = await supabase.from("notifications").insert({
      recipient_type: "platform_user",
      recipient_platform_user_id: approval.requested_by_platform_user_id,
      type: "material_rejected",
      payload_json: {
        materialId: approval.material_id,
        materialTitle: material?.title ?? null,
        approvalId,
        rejectionReason: parsedReason,
        message: t.notifications.payloads.materialRejected,
      },
    });

    if (notifyError) {
      console.error("[admins/actions] material reject notification error:", notifyError);
    }
  }

  return updatedApproval;
}

export async function approveAdminOrganization(organizationId: string) {
  const session = await requireAreaAccess("admin");
  const supabase = createServerClient();

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id, status, created_by_platform_user_id")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .single();

  if (orgError || !organization) {
    throw new Error(t.api.adminActions.organizationNotFound);
  }

  if (organization.status !== "pending") {
    throw new Error(t.api.adminActions.organizationNotPending);
  }

  const approvedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("organizations")
    .update({
      status: "active",
      approved_by_platform_user_id: session.userId,
      approved_at: approvedAt,
      updated_at: approvedAt,
    })
    .eq("id", organizationId);

  if (updateError) {
    throw new Error(t.api.adminActions.failedToApproveOrganization);
  }

  const { error: membershipError } = await supabase
    .from("organization_memberships")
    .update({
      status: "active",
      updated_at: approvedAt,
    })
    .eq("organization_id", organizationId)
    .eq("platform_user_id", organization.created_by_platform_user_id);

  if (membershipError) {
    console.error("[admins/actions] organization membership update error:", membershipError);
  }

  return {
    organizationId,
    status: "active",
    approvedAt,
    approvedBy: session.userId,
  };
}

export async function rejectAdminOrganizationApproval(organizationId: string, reason: string) {
  rejectionReasonSchema.parse(reason);
  const session = await requireAreaAccess("admin");
  const supabase = createServerClient();

  const { data: organization, error: fetchError } = await supabase
    .from("organizations")
    .select("id, name, status, approved_by_platform_user_id, approved_at")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !organization) {
    throw new Error(t.api.adminActions.organizationApprovalRequestNotFound);
  }

  if (organization.status !== "pending") {
    throw new Error(t.api.adminActions.organizationAlreadyStatus.replace("{status}", organization.status));
  }

  const { data: updatedOrg, error: updateError } = await supabase
    .from("organizations")
    .update({
      status: "suspended",
      approved_by_platform_user_id: session.userId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", organizationId)
    .select("id, name, slug, status, approved_by_platform_user_id, approved_at, updated_at")
    .single();

  if (updateError || !updatedOrg) {
    throw new Error(t.api.adminActions.failedToRejectOrganization);
  }

  return updatedOrg;
}

export async function approveAdminTestApproval(approvalId: string) {
  const session = await requireAreaAccess("admin");
  const supabase = createServerClient();

  const { data: approval, error: fetchError } = await supabase
    .from("test_approvals")
    .select("id, test_id, decision, requested_by_platform_user_id, tests(id, title, status)")
    .eq("id", approvalId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !approval) {
    throw new Error(t.api.adminActions.testApprovalRequestNotFound);
  }

  if (approval.decision !== "pending") {
    throw new Error(t.api.adminActions.testApprovalAlready.replace("{decision}", approval.decision));
  }

  const { data: updatedApproval, error: updateError } = await supabase
    .from("test_approvals")
    .update({
      decision: "approved",
      reviewed_by_platform_user_id: session.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", approvalId)
    .eq("decision", "pending")
    .select("id, test_id, decision, reviewed_by_platform_user_id, reviewed_at, updated_at")
    .single();

  if (updateError) {
    throw new Error(t.api.adminActions.failedToApproveTest);
  }

  if (!updatedApproval) {
    throw new Error(t.api.adminActions.testApprovalAlreadyProcessed);
  }

  const { error: testUpdateError } = await supabase
    .from("tests")
    .update({ status: "active" })
    .eq("id", approval.test_id)
    .is("deleted_at", null);

  if (testUpdateError) {
    console.error("[admins/actions] test approve update error:", testUpdateError);
  }

  if (approval.requested_by_platform_user_id) {
    const test = getJoinedRecord(approval.tests);
    const { error: notifyError } = await supabase.from("notifications").insert({
      recipient_type: "platform_user",
      recipient_platform_user_id: approval.requested_by_platform_user_id,
      type: "test_approved",
      payload_json: {
        testId: approval.test_id,
        testTitle: test?.title ?? null,
        approvalId,
        message: t.notifications.payloads.testApproved,
      },
    });

    if (notifyError) {
      console.error("[admins/actions] test approve notification error:", notifyError);
    }
  }

  return updatedApproval;
}

export async function rejectAdminTestApproval(approvalId: string, reason: string) {
  const parsedReason = rejectionReasonSchema.parse(reason);
  const session = await requireAreaAccess("admin");
  const supabase = createServerClient();

  const { data: approval, error: fetchError } = await supabase
    .from("test_approvals")
    .select("id, test_id, decision, requested_by_platform_user_id, tests(id, title, status)")
    .eq("id", approvalId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !approval) {
    throw new Error(t.api.adminActions.testApprovalRequestNotFound);
  }

  if (approval.decision !== "pending") {
    throw new Error(t.api.adminActions.testApprovalAlready.replace("{decision}", approval.decision));
  }

  const { data: updatedApproval, error: updateError } = await supabase
    .from("test_approvals")
    .update({
      decision: "rejected",
      decision_reason: parsedReason,
      reviewed_by_platform_user_id: session.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", approvalId)
    .eq("decision", "pending")
    .select("id, test_id, decision, decision_reason, reviewed_by_platform_user_id, reviewed_at, updated_at")
    .single();

  if (updateError) {
    throw new Error(t.api.adminActions.failedToRejectTest);
  }

  if (!updatedApproval) {
    throw new Error(t.api.adminActions.testApprovalAlreadyProcessed);
  }

  const { error: testUpdateError } = await supabase
    .from("tests")
    .update({ status: "draft" })
    .eq("id", approval.test_id)
    .is("deleted_at", null);

  if (testUpdateError) {
    console.error("[admins/actions] test reject update error:", testUpdateError);
  }

  if (approval.requested_by_platform_user_id) {
    const test = getJoinedRecord(approval.tests);
    const { error: notifyError } = await supabase.from("notifications").insert({
      recipient_type: "platform_user",
      recipient_platform_user_id: approval.requested_by_platform_user_id,
      type: "test_rejected",
      payload_json: {
        testId: approval.test_id,
        testTitle: test?.title ?? "Untitled Test",
        approvalId: approval.id,
        rejectionReason: parsedReason,
        message: t.notifications.payloads.testRejected,
      },
    });

    if (notifyError) {
      console.error("[admins/actions] test reject notification error:", notifyError);
    }
  }

  return updatedApproval;
}

export async function approveAdminTestDeletionRequest(requestId: string) {
  const session = await requireAreaAccess("admin");
  const supabase = createServerClient();

  const { data: deletionRequest, error: fetchError } = await supabase
    .from("test_deletion_requests")
    .select("id, test_id, decision, requested_by_platform_user_id, tests(id, title)")
    .eq("id", requestId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !deletionRequest) {
    throw new Error(t.api.adminActions.testDeletionRequestNotFound);
  }

  if (deletionRequest.decision !== "pending") {
    throw new Error(t.api.adminActions.testDeletionRequestAlready.replace("{decision}", deletionRequest.decision));
  }

  const { data: updatedRequest, error: updateError } = await supabase
    .from("test_deletion_requests")
    .update({
      decision: "approved",
      reviewed_by_platform_user_id: session.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("decision", "pending")
    .select("id, test_id, decision, reviewed_by_platform_user_id, reviewed_at, updated_at")
    .single();

  if (updateError) {
    throw new Error(t.api.adminActions.failedToApproveTestDeletion);
  }

  if (!updatedRequest) {
    throw new Error(t.api.adminActions.testDeletionRequestAlreadyProcessed);
  }

  const now = new Date().toISOString();
  const { error: testUpdateError } = await supabase
    .from("tests")
    .update({ deleted_at: now })
    .eq("id", deletionRequest.test_id)
    .is("deleted_at", null);

  if (testUpdateError) {
    console.error("[admins/actions] test deletion approve test update error:", testUpdateError);
  }

  const { error: questionsUpdateError } = await supabase
    .from("test_questions")
    .update({ deleted_at: now })
    .eq("test_id", deletionRequest.test_id)
    .is("deleted_at", null);

  if (questionsUpdateError) {
    console.error("[admins/actions] test deletion approve questions update error:", questionsUpdateError);
  }

  if (deletionRequest.requested_by_platform_user_id) {
    const test = getJoinedRecord(deletionRequest.tests);
    const { error: notifyError } = await supabase.from("notifications").insert({
      recipient_type: "platform_user",
      recipient_platform_user_id: deletionRequest.requested_by_platform_user_id,
      type: "test_deletion_approved",
      payload_json: {
        testId: deletionRequest.test_id,
        testTitle: test?.title ?? null,
        requestId,
        message: t.notifications.payloads.testDeletionApproved,
      },
    });

    if (notifyError) {
      console.error("[admins/actions] test deletion approve notification error:", notifyError);
    }
  }

  return updatedRequest;
}

export async function rejectAdminTestDeletionRequest(requestId: string, reason: string) {
  const parsedReason = rejectionReasonSchema.parse(reason);
  const session = await requireAreaAccess("admin");
  const supabase = createServerClient();

  const { data: deletionRequest, error: fetchError } = await supabase
    .from("test_deletion_requests")
    .select("id, test_id, decision, requested_by_platform_user_id, tests(id, title, status)")
    .eq("id", requestId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !deletionRequest) {
    throw new Error(t.api.adminActions.testDeletionRequestNotFound);
  }

  if (deletionRequest.decision !== "pending") {
    throw new Error(t.api.adminActions.testDeletionRequestAlready.replace("{decision}", deletionRequest.decision));
  }

  const { data: updatedRequest, error: updateError } = await supabase
    .from("test_deletion_requests")
    .update({
      decision: "rejected",
      review_reason: parsedReason,
      reviewed_by_platform_user_id: session.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("decision", "pending")
    .select("id, test_id, decision, review_reason, reviewed_by_platform_user_id, reviewed_at, updated_at")
    .single();

  if (updateError) {
    throw new Error(t.api.adminActions.failedToRejectTestDeletion);
  }

  if (!updatedRequest) {
    throw new Error(t.api.adminActions.testDeletionRequestAlreadyProcessed);
  }

  const { error: testUpdateError } = await supabase
    .from("tests")
    .update({ status: "active" })
    .eq("id", deletionRequest.test_id)
    .is("deleted_at", null);

  if (testUpdateError) {
    console.error("[admins/actions] test deletion reject test update error:", testUpdateError);
  }

  if (deletionRequest.requested_by_platform_user_id) {
    const test = getJoinedRecord(deletionRequest.tests);
    const { error: notifyError } = await supabase.from("notifications").insert({
      recipient_type: "platform_user",
      recipient_platform_user_id: deletionRequest.requested_by_platform_user_id,
      type: "test_deletion_rejected",
      payload_json: {
        testId: deletionRequest.test_id,
        testTitle: test?.title ?? "Untitled Test",
        requestId: deletionRequest.id,
        rejectionReason: parsedReason,
        message: t.notifications.payloads.testDeletionRejected,
      },
    });

    if (notifyError) {
      console.error("[admins/actions] test deletion reject notification error:", notifyError);
    }
  }

  return updatedRequest;
}
