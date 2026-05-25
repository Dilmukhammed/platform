import Link from "next/link";
import { t } from "@/lib/translations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <section className="border-b border-border bg-surface-raised px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <Badge variant="primary" size="sm" className="mb-4">
            {t.public.help.badge}
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t.public.help.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-foreground-secondary">
            {t.public.help.description}
          </p>
        </div>
      </section>

      {/* Help Categories */}
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Students */}
            <Card elevation="sm">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-control-md bg-primary-subtle text-primary">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
                  </svg>
                </div>
                <CardTitle>{t.public.help.forStudents}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  {t.public.help.forStudentsDescription}
                </CardDescription>
                <ul className="space-y-2 text-sm text-foreground-secondary">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <Link href="/help" className="hover:text-primary">
                      {t.public.help.howToJoinClass}
                    </Link>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{t.public.help.submittingAssignments}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{t.public.help.takingTests}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{t.public.help.viewingGrades}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Teachers */}
            <Card elevation="sm">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-control-md bg-success-subtle text-success">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <CardTitle>{t.public.help.forTeachers}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  {t.public.help.forTeachersDescription}
                </CardDescription>
                <ul className="space-y-2 text-sm text-foreground-secondary">
                  <li className="flex items-start gap-2">
                    <span className="text-success">•</span>
                    <span>{t.public.help.creatingClass}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success">•</span>
                    <span>{t.public.help.creatingAssignments}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success">•</span>
                    <span>{t.public.help.managingStudents}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success">•</span>
                    <span>{t.public.help.gradingSubmissions}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Administrators */}
            <Card elevation="sm">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-control-md bg-admin-subtle text-admin">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <CardTitle>{t.public.help.forAdmins}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  {t.public.help.forAdminsDescription}
                </CardDescription>
                <ul className="space-y-2 text-sm text-foreground-secondary">
                  <li className="flex items-start gap-2">
                    <span className="text-admin">•</span>
                    <span>{t.public.help.managingOrganizations}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-admin">•</span>
                    <span>{t.public.help.approvingContent}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-admin">•</span>
                    <span>{t.public.help.systemHealth}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-admin">•</span>
                    <span>{t.public.help.userManagement}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="border-t border-border bg-surface-raised px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-foreground">{t.public.help.faqTitle}</h2>
            <p className="mt-2 text-foreground-secondary">{t.public.help.faqDescription}</p>
          </div>

          <div className="space-y-4">
            <Card elevation="sm">
              <CardHeader>
                <CardTitle className="text-lg">{t.public.help.faq.joinClassQuestion}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t.public.help.faq.joinClassAnswer}
                </CardDescription>
              </CardContent>
            </Card>

            <Card elevation="sm">
              <CardHeader>
                <CardTitle className="text-lg">{t.public.help.faq.forgotPinQuestion}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t.public.help.faq.forgotPinAnswer}
                </CardDescription>
              </CardContent>
            </Card>

            <Card elevation="sm">
              <CardHeader>
                <CardTitle className="text-lg">{t.public.help.faq.practicalWorkQuestion}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t.public.help.faq.practicalWorkAnswer}
                </CardDescription>
              </CardContent>
            </Card>

            <Card elevation="sm">
              <CardHeader>
                <CardTitle className="text-lg">{t.public.help.faq.retakeTestQuestion}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t.public.help.faq.retakeTestAnswer}
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <Card elevation="md" className="bg-primary-subtle/30">
            <CardContent className="py-8">
              <h2 className="text-2xl font-bold text-foreground">{t.public.help.stillNeedHelpTitle}</h2>
              <p className="mx-auto mt-2 max-w-lg text-foreground-secondary">
                {t.public.help.stillNeedHelpDescription}
              </p>
              <div className="mt-6">
                <Button asChild size="lg">
                  <Link href="/contact">{t.public.help.contactSupport}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}