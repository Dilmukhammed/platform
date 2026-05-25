"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";

import { t } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteTeacherAction } from "@/modules/organizations/actions";

type InviteTeacherModalProps = {
  organizationId: string;
  organizationName: string;
};

export function InviteTeacherModal({ organizationId, organizationName }: InviteTeacherModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  if (!isOpen) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(true)}
        title={t.teacher.students.alerts.studentCreated}
      >
        <UserPlus className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsOpen(false)}>
      <div
        className="w-full max-w-md rounded-lg border border-border bg-surface-raised p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t.teacher.students.bulkImport.title}</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-md p-1 text-foreground-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-foreground-secondary">
          {t.teacher.organizations.messages.invitationSent("").split(".")[0]}
        </p>

        <form
          action={async (formData: FormData) => {
            setIsPending(true);
            await inviteTeacherAction(formData);
            setIsPending(false);
          }}
          className="space-y-4"
        >
          <input type="hidden" name="organizationId" value={organizationId} />

          <label className="grid gap-2 text-sm font-medium text-foreground">
            {t.auth.student.pin}
            <Input
              type="email"
              name="email"
              required
              placeholder={t.auth.teacher.emailPlaceholder}
              disabled={isPending}
            />
          </label>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
            >
              {t.common.back}
            </Button>
            <Button type="submit" disabled={isPending}>
              <UserPlus className="mr-2 h-4 w-4" />
              {isPending ? t.common.sending : t.teacher.organizations.invite.heading}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
