import Link from "next/link";

import { t } from "@/lib/translations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TeacherAuthHubPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted">{t.auth.shared.staffAccess}</p>
          <h1 className="text-3xl font-bold">{t.auth.teacher.portalTitle}</h1>
          <p className="text-sm text-muted">
            {t.auth.teacher.portalDescription}
          </p>
        </div>

        {/* Auth Options */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.auth.teacher.teacherHubExistingTitle}</CardTitle>
              <CardDescription>
                {t.auth.teacher.teacherHubExistingDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/auth/teacher/sign-in">{t.common.signIn}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.auth.teacher.teacherHubNewTitle}</CardTitle>
              <CardDescription>
                {t.auth.teacher.teacherHubNewDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary" className="w-full">
                <Link href="/auth/teacher/sign-up">{t.common.createAccount}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted">
          {t.auth.shared.studentAltLogin}{" "}
          <Link href="/auth/student/login" className="text-primary hover:underline">
            {t.auth.shared.useLoginPinInstead}
          </Link>
        </p>
      </div>
    </main>
  );
}
