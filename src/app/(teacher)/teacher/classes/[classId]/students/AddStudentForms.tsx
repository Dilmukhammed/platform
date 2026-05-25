"use client";

import { useState, useRef } from "react";
import { UserPlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createStudentAction, importStudentsAction } from "@/modules/students/actions";
import { t } from "@/lib/translations";

export function AddStudentForm({ classId }: { classId: string }) {
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!showForm) {
    return (
      <Button onClick={() => setShowForm(true)}>
        <UserPlus className="mr-2 h-4 w-4" />
        Add student
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={createStudentAction}
      className="flex flex-wrap items-end gap-3"
      onSubmit={() => setTimeout(() => formRef.current?.reset(), 100)}
    >
      <input type="hidden" name="classId" value={classId} />
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-secondary">Login</label>
        <input
          name="studentLogin"
          placeholder="ST-100001"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-secondary">First Name</label>
        <input
          name="firstName"
          placeholder="John"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-secondary">Last Name</label>
        <input
          name="lastName"
          placeholder="Doe"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground-secondary">PIN (4-6 digits)</label>
        <input
          name="pin"
          placeholder="1234"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          pattern="[0-9]{4,6}"
          required
        />
      </div>
      <Button type="submit">Add</Button>
      <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
        Cancel
      </Button>
    </form>
  );
}

export function ImportCSVForm({ classId }: { classId: string }) {
  const [showForm, setShowForm] = useState(false);

  if (!showForm) {
    return (
      <Button variant="secondary" onClick={() => setShowForm(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Import CSV
      </Button>
    );
  }

  return (
    <Card elevation="sm" className="bg-warning-subtle/30 border-warning-subtle">
      <CardContent className="py-4">
        <form
          action={importStudentsAction}
          className="flex flex-wrap items-center gap-4"
        >
          <input type="hidden" name="classId" value={classId} />
          <div>
            <p className="text-sm font-medium text-foreground mb-2">
              Import students from a CSV file
            </p>
            <p className="text-xs text-foreground-secondary mb-3">
              CSV format: student_login, first_name, last_name, class_code, pin
            </p>
            <div className="flex items-center gap-3">
              <textarea
                name="csvText"
                rows={4}
                placeholder="Paste CSV content here..."
                className="min-w-[300px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit">Upload</Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
