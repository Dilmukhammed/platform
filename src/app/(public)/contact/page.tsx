"use client";

import { useState } from "react";
import Link from "next/link";
import { t } from "@/lib/translations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";


export default function ContactPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    subject: "",
    message: "",
    privacyAgreed: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, privacyAgreed: e.target.checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage("");

    try {
      const response = await fetch("/api/v1/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitStatus("success");
        // Reset form
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          subject: "",
          message: "",
          privacyAgreed: false,
        });
      } else {
        setSubmitStatus("error");
        setErrorMessage(result.error?.message || t.public.contact.errorFallback);
      }
    } catch (error) {
      setSubmitStatus("error");
      setErrorMessage(t.public.contact.unexpectedError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <section className="border-b border-border bg-surface-raised px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <Badge variant="primary" size="sm" className="mb-4">
            {t.public.contact.badge}
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t.public.contact.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-foreground-secondary">
            {t.public.contact.description}
          </p>
        </div>
      </section>

      {/* Contact Content */}
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
            {/* Contact Form */}
            <Card elevation="sm">
              <CardHeader>
                <CardTitle>{t.public.contact.formTitle}</CardTitle>
                <CardDescription>
                  {t.public.contact.formDescription}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {submitStatus === "success" && (
                  <div className="rounded-xl border border-success-subtle bg-success-subtle/50 px-4 py-3 text-sm text-success mb-4">
                    {t.public.contact.successMessage}
                  </div>
                )}
                {submitStatus === "error" && (
                  <div className="rounded-xl border border-error-subtle bg-error-subtle/50 px-4 py-3 text-sm text-error mb-4">
                    {errorMessage}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label={t.public.contact.firstName} required>
                      <Input
                        name="firstName"
                        placeholder={t.public.contact.firstNamePlaceholder}
                        value={formData.firstName}
                        onChange={handleInputChange}
                        required
                      />
                    </FormField>
                    <FormField label={t.public.contact.lastName} required>
                      <Input
                        name="lastName"
                        placeholder={t.public.contact.lastNamePlaceholder}
                        value={formData.lastName}
                        onChange={handleInputChange}
                        required
                      />
                    </FormField>
                  </div>
                  
                  <FormField label={t.common.email} required>
                    <Input
                      name="email"
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                    />
                  </FormField>
                  
                  <FormField label={t.public.contact.subject} required>
                    <Input
                      name="subject"
                      placeholder={t.public.contact.subjectPlaceholder}
                      value={formData.subject}
                      onChange={handleInputChange}
                      required
                    />
                  </FormField>
                  
                  <FormField label={t.public.contact.message} required>
                    <Textarea
                      name="message"
                      placeholder={t.public.contact.messagePlaceholder}
                      rows={5}
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                    />
                  </FormField>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="privacy"
                      name="privacyAgreed"
                      checked={formData.privacyAgreed}
                      onChange={handleCheckboxChange}
                      className="h-4 w-4 rounded border-border"
                      required
                    />
                    <label htmlFor="privacy" className="text-sm text-foreground-secondary">
                      {t.public.contact.privacyAgreement}
                    </label>
                  </div>

                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? t.common.sending : t.public.contact.sendMessage}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <div className="space-y-6">
              <Card elevation="sm">
                <CardHeader>
                  <CardTitle>{t.public.contact.contactInformation}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control-md bg-primary-subtle text-primary">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{t.common.email}</p>
                      <p className="text-sm text-foreground-secondary">support@lms-platform.com</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control-md bg-success-subtle text-success">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{t.public.contact.phone}</p>
                      <p className="text-sm text-foreground-secondary">+1 (555) 123-4567</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control-md bg-info-subtle text-info">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{t.public.contact.hours}</p>
                      <p className="text-sm text-foreground-secondary">{t.public.contact.hoursValue}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card elevation="sm">
                <CardHeader>
                  <CardTitle>{t.public.contact.quickLinks}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li>
                      <Link 
                        href="/help" 
                        className="flex items-center gap-2 text-sm text-foreground-secondary hover:text-primary"
                      >
                        <span>→</span>
                        <span>{t.nav.helpCenter}</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/help" 
                        className="flex items-center gap-2 text-sm text-foreground-secondary hover:text-primary"
                      >
                        <span>→</span>
                        <span>{t.nav.studentAccessHelp}</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/terms" 
                        className="flex items-center gap-2 text-sm text-foreground-secondary hover:text-primary"
                      >
                        <span>→</span>
                        <span>{t.nav.terms}</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/privacy" 
                        className="flex items-center gap-2 text-sm text-foreground-secondary hover:text-primary"
                      >
                        <span>→</span>
                        <span>{t.nav.privacy}</span>
                      </Link>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
