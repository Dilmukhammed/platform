"use client";

import { useState } from "react";
import { Shield, Eye, EyeOff, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { t } from "@/lib/translations";

interface PasswordChangeModalProps {
  userId: string;
}

interface FormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface FormErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  general?: string;
}

export function PasswordChangeModal({ userId }: PasswordChangeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = t.admin.settings.changePassword;
    }

    if (!formData.newPassword) {
      newErrors.newPassword = t.admin.settings.changePassword;
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = t.auth.teacher.passwordHintMin;
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t.auth.teacher.passwordHintMin;
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = t.auth.teacher.passwordHintMin;
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
      const response = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
          confirmPassword: formData.confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMessage = data.error?.message || "Failed to change password";
        
        // Handle specific field errors from API
        if (data.error?.details && Array.isArray(data.error.details)) {
          const fieldErrors: FormErrors = {};
          data.error.details.forEach((detail: { field: string; message: string }) => {
            if (detail.field === "currentPassword") {
              fieldErrors.currentPassword = detail.message;
            } else if (detail.field === "newPassword") {
              fieldErrors.newPassword = detail.message;
            } else if (detail.field === "confirmPassword") {
              fieldErrors.confirmPassword = detail.message;
            }
          });
          setErrors(fieldErrors);
        } else {
          setErrors({ general: errorMessage });
        }
        setIsSubmitting(false);
        return;
      }

      // Success
      setIsSuccess(true);
      setIsSubmitting(false);

      // Reset form after a delay and close modal
      setTimeout(() => {
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setIsSuccess(false);
        setIsOpen(false);
      }, 2000);
    } catch (error) {
      setErrors({ general: "An unexpected error occurred. Please try again." });
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setIsOpen(false);
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setErrors({});
      setIsSuccess(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setIsOpen(true)}>
        {t.admin.settings.changePassword}
      </Button>

      <Modal
        open={isOpen}
        onOpenChange={(open) => !open && handleClose()}
        title={isSuccess ? t.teacher.passwordChange.success : t.admin.settings.changePassword}
        description={isSuccess ? t.teacher.passwordChange.successMessage : t.admin.settings.changePassword}
      >
        {isSuccess ? (
          <div className="flex flex-col items-center text-center py-8">
            <div className="mb-4 rounded-full bg-success-subtle/50 p-4">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <Button
              variant="secondary"
              onClick={handleClose}
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <div className="rounded-md border border-error bg-error-subtle/30 p-3 text-sm text-error">
                {errors.general}
              </div>
            )}

<FormField
              label={t.auth.teacher.confirmPassword}
              htmlFor="confirmPassword"
              error={errors.confirmPassword}
              required
            >
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                  placeholder={t.auth.teacher.passwordPlaceholder}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-secondary hover:text-foreground"
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            <FormField
              label="New Password"
              htmlFor="newPassword"
              error={errors.newPassword}
              hint="Must be at least 8 characters"
              required
            >
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={formData.newPassword}
                  onChange={(e) => handleInputChange("newPassword", e.target.value)}
                  placeholder="Enter your new password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-secondary hover:text-foreground"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

<FormField
              label={t.auth.teacher.resetPasswordTitle}
              htmlFor="newPassword"
              hint={t.auth.teacher.passwordHintMin}
              required
            >
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={formData.newPassword}
                  onChange={(e) => handleInputChange("newPassword", e.target.value)}
                  placeholder={t.auth.teacher.passwordPlaceholder}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-secondary hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            <ModalFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                {t.common.back}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t.common.sending : t.admin.settings.change}
              </Button>
            </ModalFooter>
          </form>
        )}
      </Modal>
    </>
  );
}
