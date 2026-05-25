import Link from "next/link";
import { t } from "@/lib/translations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PrivacyPage() {
  const lastUpdated = "January 1, 2024";

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <section className="border-b border-border bg-surface-raised px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Badge variant="primary" size="sm" className="mb-4">
            {t.common.legal}
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t.legal.privacy.title}
          </h1>
          <p className="mt-4 text-foreground-secondary">
            {t.legal.common.lastUpdated(lastUpdated)}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Card elevation="sm">
            <CardContent className="prose prose-slate max-w-none p-8">
              <div className="space-y-8 text-foreground-secondary">
                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.privacy.sections.introduction.title}
                  </h2>
                  <p className="mt-3">{t.legal.privacy.sections.introduction.body}</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.privacy.sections.collectedInfo.title}
                  </h2>
                  <p className="mt-3">{t.legal.privacy.sections.collectedInfo.intro}</p>
                  <h3 className="mt-4 font-medium text-foreground">
                    {t.legal.privacy.sections.collectedInfo.personalInfoTitle}
                  </h3>
                  <ul className="mt-2 list-disc space-y-2 pl-6">
                    {t.legal.privacy.sections.collectedInfo.personalInfo.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>

                  <h3 className="mt-4 font-medium text-foreground">
                    {t.legal.privacy.sections.collectedInfo.usageInfoTitle}
                  </h3>
                  <ul className="mt-2 list-disc space-y-2 pl-6">
                    {t.legal.privacy.sections.collectedInfo.usageInfo.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>

                  <h3 className="mt-4 font-medium text-foreground">
                    {t.legal.privacy.sections.collectedInfo.educationalContentTitle}
                  </h3>
                  <ul className="mt-2 list-disc space-y-2 pl-6">
                    {t.legal.privacy.sections.collectedInfo.educationalContent.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.privacy.sections.useOfInfo.title}
                  </h2>
                  <p className="mt-3">{t.legal.privacy.sections.useOfInfo.intro}</p>
                  <ul className="mt-3 list-disc space-y-2 pl-6">
                    {t.legal.privacy.sections.useOfInfo.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.privacy.sections.sharing.title}
                  </h2>
                  <p className="mt-3">{t.legal.privacy.sections.sharing.intro}</p>
                  <ul className="mt-3 list-disc space-y-2 pl-6">
                    {t.legal.privacy.sections.sharing.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.privacy.sections.security.title}
                  </h2>
                  <p className="mt-3">{t.legal.privacy.sections.security.body}</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.privacy.sections.retention.title}
                  </h2>
                  <p className="mt-3">{t.legal.privacy.sections.retention.body}</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.privacy.sections.rights.title}
                  </h2>
                  <p className="mt-3">{t.legal.privacy.sections.rights.intro}</p>
                  <ul className="mt-3 list-disc space-y-2 pl-6">
                    {t.legal.privacy.sections.rights.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                  <p className="mt-3">{t.legal.privacy.sections.rights.outro}</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.privacy.sections.children.title}
                  </h2>
                  <p className="mt-3">{t.legal.privacy.sections.children.body}</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.privacy.sections.cookies.title}
                  </h2>
                  <p className="mt-3">{t.legal.privacy.sections.cookies.body}</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.privacy.sections.thirdParty.title}
                  </h2>
                  <p className="mt-3">{t.legal.privacy.sections.thirdParty.body}</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.privacy.sections.policyChanges.title}
                  </h2>
                  <p className="mt-3">{t.legal.privacy.sections.policyChanges.body}</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.privacy.sections.contact.title}
                  </h2>
                  <p className="mt-3">{t.legal.privacy.sections.contact.intro}</p>
                  <ul className="mt-3 list-disc space-y-2 pl-6">
                    {t.legal.privacy.sections.contact.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 text-center">
            <p className="text-sm text-foreground-secondary">{t.legal.privacy.footer}</p>
          </div>
        </div>
      </section>
    </div>
  );
}