"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { AddToClassModal } from "./AddToClassModal";
import { getStatusChipProps } from "./status-helpers";
import type { TeacherMaterialSummary } from "@/modules/teachers/server-data";
import { t } from "@/lib/translations";

function formatUpdatedAt(value: string) {
  const d = new Date(value);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year}, ${hours}:${minutes}`;
}

/**
 * Check if material is eligible to be added to a class
 * Eligible if:
 * 1. Personal material owned by current teacher
 * 2. School-visible material (approved for the selected org)
 */
function isMaterialEligibleForClass(
  material: TeacherMaterialSummary,
  currentTeacherId: string
): boolean {
  // Personal material owned by current teacher
  if (
    material.scopeType === "personal" &&
    material.ownerTeacherId === currentTeacherId
  ) {
    return true;
  }

  // School-visible material (approved for the selected org)
  if (material.schoolVisible) {
    return true;
  }

  return false;
}

interface MaterialCardProps {
  material: TeacherMaterialSummary;
  selectedOrganizationId: string | null;
  currentTeacherId: string;
  onSubmitToSchool?: string | ((formData: FormData) => void | Promise<void>);
}

export function MaterialCard({
  material,
  selectedOrganizationId,
  currentTeacherId,
  onSubmitToSchool,
}: MaterialCardProps) {
  const statusProps = getStatusChipProps(material);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canAddToClass = isMaterialEligibleForClass(material, currentTeacherId);

  const handleSuccess = (classNames: string[]) => {
    const label = classNames.length === 1
      ? `"${classNames[0]}"`
      : `${classNames.length} ta sinf`;
    setSuccessMessage(`${t.teacher.materials.alerts.submitted} ${label}`);
    // Auto-hide success message after 3 seconds
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <>
      <Card elevation="sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="truncate">
                <Link
                  href={`/teacher/materials/${material.materialId}`}
                  className="transition-colors hover:text-primary"
                >
                  {material.title}
                </Link>
              </CardTitle>
              <CardDescription>{material.scopeType === "personal" ? t.teacher.materials.card.scopeTypes.personal : t.teacher.materials.card.scopeTypes.organization}</CardDescription>
            </div>
            <StatusChip status={statusProps.status} label={statusProps.label} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-body text-foreground-secondary">
            {material.description ?? t.teacher.materials.card.noDescription}
          </p>

          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-secondary">{t.teacher.materials.card.updated}</dt>
                <dd className="font-medium text-foreground">
                  {formatUpdatedAt(material.updatedAt)}
                </dd>
            </div>
            <div className="flex justify-between gap-4">
<dt className="text-foreground-secondary">{t.teacher.materials.card.schoolVisibility}</dt>
                <dd className="font-medium text-foreground">
                  {material.schoolVisible ? (
                    <span className="text-success">{t.teacher.materials.card.visibleInSchool}</span>
                  ) : (
                    <span className="text-foreground-secondary">
                      {t.teacher.materials.card.hiddenFromSchool}
                    </span>
                  )}
               </dd>
             </div>
           </dl>

           {material.reviewState === "rejected" && (
             <div className="mt-4 rounded-lg border border-error-subtle bg-error-subtle/50 px-4 py-3 text-sm">
               <span className="font-medium text-error">{t.teacher.materials.card.rejected}</span>
             </div>
           )}

          {/* Success message for adding to class */}
          {successMessage && (
            <div className="mt-4 rounded-lg border border-success-subtle bg-success-subtle/50 px-4 py-3 text-sm text-success">
              {successMessage}
            </div>
          )}

          <div className="mt-5 space-y-3">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/teacher/materials/${material.materialId}`}>
                {t.teacher.materials.card.openDetails}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            {/* Add to Class button - shown for eligible materials */}
            {canAddToClass && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setIsModalOpen(true)}
              >
{t.teacher.materials.card.addToClass}
              </Button>
            )}

            {/* Existing status/action section */}
            {material.reviewState === "none" ? (
              material.status === "draft" ? (
                selectedOrganizationId ? (
                  <form action={onSubmitToSchool}>
                    <input
                      type="hidden"
                      name="materialId"
                      value={material.materialId}
                    />
                    <input
                      type="hidden"
                      name="organizationId"
                      value={selectedOrganizationId}
                    />
                    <Button type="submit" variant="primary" size="sm">
                      {t.teacher.materials.card.submitToSchool}
                    </Button>
                  </form>
                ) : (
                  <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-sm text-foreground-secondary">
                    {t.teacher.materials.card.selectOrgToSubmit}
                  </div>
                )
              ) : material.status === "active" ? (
                <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-sm text-foreground-secondary">
                    {t.teacher.materials.card.activeNotSubmitted}
                  </div>
              ) : null
            ) : material.reviewState === "pending" ? (
              <div className="rounded-lg bg-warning-subtle/50 border border-warning-subtle px-4 py-3 text-sm text-foreground-secondary">
                {t.teacher.materials.card.waitingForApproval}
              </div>
            ) : material.reviewState === "approved" ? (
              <div className="rounded-lg bg-success-subtle/50 border border-success-subtle px-4 py-3 text-sm text-foreground-secondary">
                {t.teacher.materials.card.approvedVisible}
              </div>
            ) : material.reviewState === "rejected" ? (
              <div className="rounded-lg bg-error-subtle/50 border border-error-subtle px-4 py-3 text-sm text-foreground-secondary">
                {t.teacher.materials.card.rejectedHidden}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Add to Class Modal */}
      <AddToClassModal
        materialId={material.materialId}
        materialTitle={material.title}
        organizationId={selectedOrganizationId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
