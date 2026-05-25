import Link from "next/link";
import { Building2, Users, ArrowRight, Plus, UserPlus } from "lucide-react";

import { t } from "@/lib/translations";
import { requireAreaAccess } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format-date";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { selectTeacherOrganizationAction } from "@/modules/organizations/actions";
import { InviteTeacherModal } from "./InviteTeacherModal";
import {
  getTeacherSelectedOrganization,
  listTeacherOrganizations,
  type TeacherOrganizationMembershipSummary,
} from "@/modules/teachers/server-data";

type OrganizationMembership = TeacherOrganizationMembershipSummary;

function getStatusVariant(status: string): "default" | "primary" | "success" | "warning" | "error" | "info" {
  switch (status) {
    case "active":
      return "success";
    case "pending":
      return "warning";
    default:
      return "default";
  }
}

function getRoleVariant(role: string): "default" | "primary" | "success" | "warning" | "error" | "info" {
  switch (role) {
    case "owner":
      return "primary";
    default:
      return "default";
  }
}

export default async function TeacherOrganizationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAreaAccess("teacher");
  const [memberships, selectedOrganization] = await Promise.all([
    listTeacherOrganizations(session.userId, { pageSize: 100 }),
    getTeacherSelectedOrganization(session.userId),
  ]);

  const selectedOrgId = selectedOrganization.organizationId;
  
  const params = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  
  // Only show "pending" message if there are actually pending memberships
  const hasPendingMemberships = memberships.some((m) => m.status === "pending" || m.membershipStatus === "pending");
  const showRequestedMessage = typeof params.requested === "string" && hasPendingMemberships;

  const message = showRequestedMessage
    ? t.teacher.organizations.messages.requestSubmitted
    : (typeof params.requested === "string" && !hasPendingMemberships)
      ? t.teacher.organizations.messages.approved
      : typeof params.invited === "string"
        ? t.teacher.organizations.messages.invitationSent(decodeURIComponent(params.invited))
        : typeof params.selected === "string"
          ? t.teacher.organizations.messages.selected
          : null;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-h1 font-bold text-foreground">{t.teacher.organizations.title}</h1>
        <p className="mt-1 text-body text-foreground-secondary">
          {t.teacher.organizations.description}
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-card border p-4 ${
          showRequestedMessage
            ? "border-warning bg-warning-subtle text-warning"
            : "border-success bg-success-subtle text-success"
        }`}>
          {message}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-card border border-error bg-error-subtle p-4 text-error">
          {error}
        </div>
      )}

      {/* Selected Organization Banner */}
      {selectedOrganization.organizationId && (
        <div className="rounded-card border border-primary bg-primary-subtle p-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="text-sm text-foreground">
              {t.teacher.organizations.activeOrganization(selectedOrganization.organizationName)}
            </span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {memberships.length === 0 && (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title={t.teacher.organizations.empty.title}
          description={t.teacher.organizations.empty.description}
          action={
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/organization/request">
                  <Plus className="mr-2 h-4 w-4" />
                  {t.teacher.organizations.empty.createOrganization}
                </Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/auth/teacher/invite/accept">
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t.teacher.organizations.empty.joinViaInvite}
                </Link>
              </Button>
            </div>
          }
        />
      )}

      {/* Organizations Grid */}
      {memberships.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {memberships.map((membership) => (
              <Card
                key={membership.organizationId}
                elevation="sm"
                className="h-full"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-1">{membership.name}</CardTitle>
                    <Badge variant={getStatusVariant(membership.status)} size="sm">
                      {membership.status}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-1">
                    {membership.slug}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-foreground-secondary">
                      <Users className="h-4 w-4 shrink-0" />
                      <span>{t.teacher.organizations.card.role}: <Badge variant={getRoleVariant(membership.role)} size="sm">{membership.role}</Badge></span>
                    </div>
                    <div className="flex items-center gap-2 text-foreground-secondary">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span>{t.teacher.organizations.card.status}: <Badge variant={getStatusVariant(membership.membershipStatus)} size="sm">{membership.membershipStatus}</Badge></span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex-col gap-3 border-t border-border pt-4">
                  <div className="flex w-full items-center justify-between text-sm text-foreground-secondary">
                    <span>{t.teacher.organizations.card.joined(formatDate(membership.joinedAt))}</span>
                    {membership.role === "owner" && membership.membershipStatus === "active" && membership.status === "active" && (
                      <InviteTeacherModal
                        organizationId={membership.organizationId}
                        organizationName={membership.name}
                      />
                    )}
                  </div>
                  
                  {membership.membershipStatus === "active" && membership.status === "active" ? (
                    <form action={selectTeacherOrganizationAction} className="w-full">
                      <input type="hidden" name="organizationId" value={membership.organizationId} />
                      <Button
                        type="submit"
                        variant={selectedOrgId === membership.organizationId ? "secondary" : "primary"}
                        className="w-full"
                        disabled={selectedOrgId === membership.organizationId}
                      >
                        {selectedOrgId === membership.organizationId ? t.teacher.organizations.card.currentlySelected : t.teacher.organizations.card.selectOrganization}
                      </Button>
                    </form>
                  ) : (
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled
                      title={t.teacher.organizations.card.pendingApprovalTitle}
                    >
                      {t.teacher.organizations.card.awaitingApproval}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Create/Join CTAs */}
          <div className="flex flex-wrap justify-center gap-3 pt-4">
            <Button variant="secondary" asChild>
              <Link href="/organization/request">
                <Plus className="mr-2 h-4 w-4" />
                {t.teacher.organizations.empty.createOrganization}
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/auth/teacher/invite/accept">
                <UserPlus className="mr-2 h-4 w-4" />
                {t.teacher.organizations.empty.joinViaInvite}
              </Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
