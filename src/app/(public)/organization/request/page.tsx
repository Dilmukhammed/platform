import Link from "next/link";

import { Input } from "@/components/ui/input";
import { t } from "@/lib/translations";
import { requireAreaAccess } from "@/lib/auth/guards";
import { submitOrganizationRequestAction } from "@/modules/organizations/actions";

export default async function OrganizationRequestPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAreaAccess("teacher");
  const params = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  const error = typeof params.error === "string" ? params.error : null;
  const success = typeof params.success === "string" ? params.success : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted">{t.public.orgRequest.eyebrow}</p>
        <h1 className="text-4xl font-bold text-foreground">{t.public.orgRequest.title}</h1>
        <p className="text-sm text-muted">
          {t.public.orgRequest.description}
        </p>
        <Link href="/teacher/organizations" className="text-sm font-medium text-blue-700">
          ← {t.public.orgRequest.backToOrganizations}
        </Link>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div> : null}

      <form action={submitOrganizationRequestAction} className="grid gap-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <label className="grid gap-2 text-sm font-medium text-foreground">
          {t.public.orgRequest.organizationName}
          <Input
            type="text"
            name="name"
            required
            minLength={3}
            placeholder={t.public.orgRequest.organizationNamePlaceholder}
          />
        </label>

        <button type="submit" className="w-fit rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white">
          {t.public.orgRequest.submitForApproval}
        </button>
      </form>
    </main>
  );
}