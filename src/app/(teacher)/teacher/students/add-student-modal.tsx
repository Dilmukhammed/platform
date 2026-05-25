"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { t } from "@/lib/translations";

interface TeacherClass {
  classId: string;
  title: string;
}

interface AddStudentModalProps {
  classes: TeacherClass[];
  organizationSlug: string;
}

interface FormData {
  studentLogin: string;
  firstName: string;
  lastName: string;
  pin: string;
  classId: string;
}

interface FormErrors {
  studentLogin?: string;
  firstName?: string;
  lastName?: string;
  pin?: string;
  classId?: string;
  general?: string;
}

export function AddStudentModal({ classes, organizationSlug }: AddStudentModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    studentLogin: "",
    firstName: "",
    lastName: "",
    pin: "",
    classId: classes.length > 0 ? classes[0].classId : "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.studentLogin.trim()) {
      newErrors.studentLogin = t.auth.student.studentLogin + " " + t.common.optional;
    } else if (formData.studentLogin.length > 255) {
      newErrors.studentLogin = t.auth.student.studentLogin + " 255 " + t.auth.teacher.passwordHintMin.split(" ")[0];
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = t.auth.student.firstName + " " + t.common.optional;
    } else if (formData.firstName.length > 255) {
      newErrors.firstName = t.auth.student.firstName + " 255 " + t.auth.teacher.passwordHintMin.split(" ")[0];
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = t.auth.student.lastName + " " + t.common.optional;
    } else if (formData.lastName.length > 255) {
      newErrors.lastName = t.auth.student.lastName + " 255 " + t.auth.teacher.passwordHintMin.split(" ")[0];
    }

    if (!formData.pin.trim()) {
      newErrors.pin = t.auth.student.pin + " " + t.common.optional;
    } else if (!/^\d{4,6}$/.test(formData.pin)) {
      newErrors.pin = t.auth.student.pin + " 4-6 " + t.teacher.addStudent.pinHint;
    }

    if (!formData.classId) {
      newErrors.classId = t.teacher.classes.title + " " + t.common.optional;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch(`/api/v1/teacher/classes/${formData.classId}/students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentLogin: formData.studentLogin.trim(),
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          pin: formData.pin.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (errorData?.message) {
          setErrors({ general: errorData.message });
        } else {
          setErrors({ general: "Failed to create student. Please try again." });
        }
        setIsSubmitting(false);
        return;
      }

      const data = await response.json();
      
      // Close modal and refresh page to show new student
      setIsOpen(false);
      
      // Reset form
      setFormData({
        studentLogin: "",
        firstName: "",
        lastName: "",
        pin: "",
        classId: classes.length > 0 ? classes[0].classId : "",
      });

      // Redirect with success message
      const selectedClass = classes.find(c => c.classId === formData.classId);
      const className = selectedClass?.title || "";
      const params = new URLSearchParams({
        created: "true",
        student: data.data?.displayName || `${formData.firstName} ${formData.lastName}`,
        login: formData.studentLogin,
        ...(className && { className }),
      });
      window.location.href = `/teacher/students?${params.toString()}`;
    } catch (error) {
      setErrors({ general: "An unexpected error occurred. Please try again." });
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (classes.length === 0) {
    return (
      <Button disabled title={t.teacher.classes.messages.emptyDescription}>
        <UserPlus className="mr-2 h-4 w-4" />
        {t.teacher.students.bulkImport.title}
      </Button>
    );
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" />
        {t.teacher.students.bulkImport.title}
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md animate-in fade-in zoom-in duration-200">
            <Card elevation="md" className="w-full">
              <form onSubmit={handleSubmit}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{t.teacher.students.bulkImport.title}</CardTitle>
                      <CardDescription>
                        {t.teacher.students.bulkImport.description}
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsOpen(false)}
                      className="-mr-2 -mt-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {errors.general && (
                    <div className="rounded-md border border-error bg-error-subtle/30 p-3 text-sm text-error">
                      {errors.general}
                    </div>
                  )}

                  <FormField
                    label={t.teacher.classes.title}
                    htmlFor="classId"
                    error={errors.classId}
                    required
                  >
                    <Select
                      id="classId"
                      value={formData.classId}
                      onChange={(e) => handleInputChange("classId", e.target.value)}
                    >
                      {classes.map((cls) => (
                        <option key={cls.classId} value={cls.classId}>
                          {cls.title}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField
                    label={t.auth.student.studentLogin}
                    htmlFor="studentLogin"
                    error={errors.studentLogin}
                    hint={t.auth.student.studentLoginHint}
                    required
                  >
                    <Input
                      id="studentLogin"
                      value={formData.studentLogin}
                      onChange={(e) => handleInputChange("studentLogin", e.target.value)}
                      placeholder={t.auth.student.studentLoginHint}
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      label={t.auth.student.firstName}
                      htmlFor="firstName"
                      error={errors.firstName}
                      required
                    >
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange("firstName", e.target.value)}
                        placeholder={t.auth.student.firstNamePlaceholder}
                      />
                    </FormField>

                    <FormField
                      label={t.auth.student.lastName}
                      htmlFor="lastName"
                      error={errors.lastName}
                      required
                    >
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange("lastName", e.target.value)}
                        placeholder={t.auth.student.lastNamePlaceholder}
                      />
                    </FormField>
                  </div>

                  <FormField
                    label={t.auth.student.pin}
                    htmlFor="pin"
                    error={errors.pin}
                    hint={t.auth.student.createPinHint}
                    required
                  >
                    <Input
                      id="pin"
                      type="password"
                      inputMode="numeric"
                      pattern="\d{4,6}"
                      maxLength={6}
                      value={formData.pin}
                      onChange={(e) => handleInputChange("pin", e.target.value.replace(/\D/g, ""))}
                      placeholder={t.auth.student.createPinPlaceholder}
                    />
                  </FormField>
                </CardContent>

                <CardFooter className="flex justify-end gap-3 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsOpen(false)}
                    disabled={isSubmitting}
                  >
                    {t.common.back}
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? t.common.sending : t.teacher.students.alerts.studentCreated}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
