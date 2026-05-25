import Link from "next/link";
import { t } from "@/lib/translations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TermsPage() {
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
            {t.legal.terms.title}
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
                    {t.legal.terms.sections.acceptance.title}
                  </h2>
                  <p className="mt-3">{t.legal.terms.sections.acceptance.body}</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.terms.sections.description.title}
                  </h2>
                  <p className="mt-3">{t.legal.terms.sections.description.intro}</p>
                  <ul className="mt-3 list-disc space-y-2 pl-6">
                    {t.legal.terms.sections.description.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.terms.sections.accounts.title}
                  </h2>
                  <p className="mt-3">{t.legal.terms.sections.accounts.intro}</p>
                  <ul className="mt-3 list-disc space-y-2 pl-6">
                    {t.legal.terms.sections.accounts.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.terms.sections.conduct.title}
                  </h2>
                  <p className="mt-3">{t.legal.terms.sections.conduct.intro}</p>
                  <ul className="mt-3 list-disc space-y-2 pl-6">
                    {t.legal.terms.sections.conduct.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.terms.sections.content.title}
                  </h2>
                  <p className="mt-3">{t.legal.terms.sections.content.body1}</p>
                  <p className="mt-3">{t.legal.terms.sections.content.body2}</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.terms.sections.privacy.title}
                  </h2>
                  <p className="mt-3">
                    {t.legal.terms.sections.privacy.body}{" "}
                    <Link href="/privacy" className="text-primary hover:underline">
                      {t.legal.terms.sections.privacy.policyLabel}
                    </Link>
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.terms.sections.termination.title}
                  </h2>
                  <p className="mt-3">{t.legal.terms.sections.termination.body}</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.terms.sections.warranties.title}
                  </h2>
                  <p className="mt-3">{t.legal.terms.sections.warranties.body}</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.terms.sections.liability.title}
                  </h2>
                  <p className="mt-3">{t.legal.terms.sections.liability.body}</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.terms.sections.changes.title}
                  </h2>
                  <p className="mt-3">{t.legal.terms.sections.changes.body}</p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t.legal.terms.sections.contact.title}
                  </h2>
                  <p className="mt-3">
                    {t.legal.terms.sections.contact.body}{" "}
                    <Link href="/contact" className="text-primary hover:underline">
                      {t.legal.terms.sections.contact.supportLabel}
                    </Link>
                  </p>
                </section>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 text-center">
            <p className="text-sm text-foreground-secondary">{t.legal.terms.footer}</p>
          </div>
        </div>
      </section>
    </div>
  );
}