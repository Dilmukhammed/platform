"use client";

import Link from "next/link";
import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
  Loader2,
} from "lucide-react";

import { apiPost } from "@/lib/api/client-fetch";
import { DownloadTemplateButton } from "./DownloadTemplateButton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

/**
 * CSV Import Client Component for Students
 *
 * Features:
 * - CSV file upload with drag-and-drop area
 * - CSV content paste option
 * - Client-side preview of parsed data with validation
 * - Validation indicators for each row
 * - Import action with error handling
 */

interface CsvStudentRow {
  lineNumber: number;
  studentLogin: string;
  firstName: string;
  lastName: string;
  classCode: string;
  organizationSlug: string;
  pin: string;
}

interface ValidationError {
  field: string;
  message: string;
}

interface ValidatedRow extends CsvStudentRow {
  status: "valid" | "invalid" | "warning";
  errors: ValidationError[];
}

interface ImportResult {
  classId: string;
  totalProcessed: number;
  profilesCreated: number;
  existingProfilesUsed: number;
  failed: number;
  errors?: Array<{ studentLogin: string; error: string }>;
}

const REQUIRED_HEADERS = [
  "student_login",
  "first_name",
  "last_name",
  "class_code",
  "organization_slug",
  "pin",
];

function getStatusBadgeVariant(
  status: ValidatedRow["status"]
): "default" | "primary" | "success" | "warning" | "error" | "info" {
  switch (status) {
    case "valid":
      return "success";
    case "warning":
      return "warning";
    case "invalid":
      return "error";
    default:
      return "default";
  }
}

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse CSV handling quoted values
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

function validateRow(
  row: CsvStudentRow,
  expectedOrgSlug: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required field checks
  if (!row.studentLogin || row.studentLogin.trim().length === 0) {
    errors.push({ field: "student_login", message: "Required" });
  }

  if (!row.firstName || row.firstName.trim().length === 0) {
    errors.push({ field: "first_name", message: "Required" });
  } else if (row.firstName.trim().length < 2) {
    errors.push({ field: "first_name", message: "Min 2 characters" });
  }

  if (!row.lastName || row.lastName.trim().length === 0) {
    errors.push({ field: "last_name", message: "Required" });
  } else if (row.lastName.trim().length < 2) {
    errors.push({ field: "last_name", message: "Min 2 characters" });
  }

  if (!row.classCode || row.classCode.trim().length === 0) {
    errors.push({ field: "class_code", message: "Required" });
  }

  if (!row.organizationSlug || row.organizationSlug.trim().length === 0) {
    errors.push({ field: "organization_slug", message: "Required" });
  } else if (row.organizationSlug.trim() !== expectedOrgSlug) {
    errors.push({
      field: "organization_slug",
      message: `Must be "${expectedOrgSlug}"`,
    });
  }

  // PIN validation - must be 4-6 digits
  if (!row.pin || row.pin.trim().length === 0) {
    errors.push({ field: "pin", message: "Required" });
  } else if (!/^\d{4,6}$/.test(row.pin.trim())) {
    errors.push({ field: "pin", message: "Must be 4-6 digits" });
  }

  return errors;
}

function processCSV(
  content: string,
  expectedOrgSlug: string
): {
  rows: ValidatedRow[];
  headersValid: boolean;
  headerErrors: string[];
} {
  const { headers, rows: rawRows } = parseCSV(content);

  // Validate headers
  const headerErrors: string[] = [];
  const missingHeaders = REQUIRED_HEADERS.filter(
    (h) => !headers.includes(h.toLowerCase())
  );
  if (missingHeaders.length > 0) {
    headerErrors.push(`Missing required columns: ${missingHeaders.join(", ")}`);
  }

  const headersValid = missingHeaders.length === 0;

  // Map column indices
  const colIndex: Record<string, number> = {};
  headers.forEach((h, i) => {
    colIndex[h.toLowerCase()] = i;
  });

  // Process rows
  const rows: ValidatedRow[] = rawRows.map((rawRow, index) => {
    const lineNumber = index + 2; // +2 because line 1 is header

    const studentRow: CsvStudentRow = {
      lineNumber,
      studentLogin: rawRow[colIndex["student_login"]] || "",
      firstName: rawRow[colIndex["first_name"]] || "",
      lastName: rawRow[colIndex["last_name"]] || "",
      classCode: rawRow[colIndex["class_code"]] || "",
      organizationSlug: rawRow[colIndex["organization_slug"]] || "",
      pin: rawRow[colIndex["pin"]] || "",
    };

    const errors = validateRow(studentRow, expectedOrgSlug);

    let status: ValidatedRow["status"] = "valid";
    if (errors.length > 0) {
      status = errors.some((e) => e.field === "organization_slug")
        ? "warning"
        : "invalid";
    }

    return {
      ...studentRow,
      status,
      errors,
    };
  });

  return { rows, headersValid, headerErrors };
}

interface StudentImportClientProps {
  selectedOrganization: {
    id: string;
    name: string;
    organizationName: string;
    organizationSlug: string;
  } | null;
}

export function StudentImportClient({
  selectedOrganization,
}: StudentImportClientProps) {
  const router = useRouter();
  const [csvContent, setCsvContent] = useState<string>("");
  const [parsedData, setParsedData] = useState<{
    rows: ValidatedRow[];
    headersValid: boolean;
    headerErrors: string[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
        setImportError("Please upload a CSV file");
        return;
      }

      try {
        const text = await file.text();
        setCsvContent(text);

        if (selectedOrganization) {
          const processed = processCSV(text, selectedOrganization.organizationSlug);
          setParsedData(processed);
          setImportError(null);
        }
      } catch (error) {
        setImportError("Failed to read file");
        console.error("File read error:", error);
      }
    },
    [selectedOrganization]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    },
    [handleFileUpload]
  );

  const handleTextChange = useCallback(
    (text: string) => {
      setCsvContent(text);
      if (selectedOrganization && text.trim()) {
        const processed = processCSV(text, selectedOrganization.organizationSlug);
        setParsedData(processed);
      } else {
        setParsedData(null);
      }
    },
    [selectedOrganization]
  );

  const handleImport = useCallback(async () => {
    if (!parsedData || !selectedOrganization) return;

    // Check if there are any valid rows to import
    const validRows = parsedData.rows.filter((r) => r.status !== "invalid");
    if (validRows.length === 0) {
      setImportError("No valid rows to import. Please fix errors and try again.");
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      // Fetch teacher's classes to map class_code → classId
      let classCodeMap = new Map<string, string>(); // classCode → classId
      try {
        const classesResponse = await fetch("/api/v1/teacher/classes");
        if (classesResponse.ok) {
          const classesData = await classesResponse.json() as { data?: Array<{ classId: string; joinCode?: { code: string } | null }> };
          for (const cls of classesData.data ?? []) {
            if (cls.joinCode?.code) {
              classCodeMap.set(cls.joinCode.code, cls.classId);
            }
          }
        }
      } catch {
        // If class lookup fails, fall through to single-class import
      }

      // Group students by classCode → classId
      const byClass = new Map<string, typeof validRows>();
      const unmatched: typeof validRows = [];

      for (const row of validRows) {
        const classId = classCodeMap.get(row.classCode.trim());
        if (classId) {
          const group = byClass.get(classId) ?? [];
          group.push(row);
          byClass.set(classId, group);
        } else {
          unmatched.push(row);
        }
      }

      // Import per class
      let totalResult: ImportResult = {
        classId: "",
        totalProcessed: 0,
        profilesCreated: 0,
        existingProfilesUsed: 0,
        failed: 0,
        errors: [],
      };

      const allGroups = [...byClass.entries()];
      // If no class mapping found, fall back to original org-level import
      if (allGroups.length === 0) {
        const students = validRows.map((row) => ({
          studentLogin: row.studentLogin.trim(),
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          pin: row.pin.trim(),
        }));

        const result = await apiPost<ImportResult>("/api/v1/teacher/students/import", { students });
        totalResult = result;
      } else {
        for (const [classId, rows] of allGroups) {
          const students = rows.map((row) => ({
            studentLogin: row.studentLogin.trim(),
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            pin: row.pin.trim(),
          }));

          const result = await apiPost<ImportResult>("/api/v1/teacher/students/import", {
            classId,
            students,
          });

          totalResult.totalProcessed += result.totalProcessed;
          totalResult.profilesCreated += result.profilesCreated;
          totalResult.existingProfilesUsed += result.existingProfilesUsed;
          totalResult.failed += result.failed;
          if (result.errors) {
            totalResult.errors = [...(totalResult.errors ?? []), ...result.errors];
          }
        }

        // Handle unmatched rows (no matching class code found)
        if (unmatched.length > 0) {
          const students = unmatched.map((row) => ({
            studentLogin: row.studentLogin.trim(),
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            pin: row.pin.trim(),
          }));

          const result = await apiPost<ImportResult>("/api/v1/teacher/students/import", { students });
          totalResult.totalProcessed += result.totalProcessed;
          totalResult.profilesCreated += result.profilesCreated;
          totalResult.existingProfilesUsed += result.existingProfilesUsed;
          totalResult.failed += result.failed;
          if (result.errors) {
            totalResult.errors = [...(totalResult.errors ?? []), ...result.errors];
          }
        }
      }

      setImportResult(totalResult);

      // Redirect on success if no failures
      if (totalResult.failed === 0) {
        router.push("/teacher/students?imported=true");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import students";
      setImportError(message);
    } finally {
      setIsImporting(false);
    }
  }, [parsedData, selectedOrganization, router]);

  const stats = useMemo(() => {
    if (!parsedData) return null;
    const total = parsedData.rows.length;
    const valid = parsedData.rows.filter((r) => r.status === "valid").length;
    const warning = parsedData.rows.filter((r) => r.status === "warning").length;
    const invalid = parsedData.rows.filter((r) => r.status === "invalid").length;
    return { total, valid, warning, invalid };
  }, [parsedData]);

  // No organization selected state
  if (!selectedOrganization) {
    return (
      <section className="space-y-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/teacher/students">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Students
          </Link>
        </Button>

        <div>
          <h1 className="text-h1 font-bold text-foreground">Import Students</h1>
          <p className="mt-1 text-body text-foreground-secondary">
            Bulk import students from CSV
          </p>
        </div>

        <Card elevation="sm">
          <EmptyState
            icon={<AlertCircle className="h-6 w-6" />}
            title="No Organization Selected"
            description="Select an approved organization before importing students."
            action={
              <Button asChild>
                <Link href="/teacher/organizations">Go to Organizations</Link>
              </Button>
            }
          />
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Back Navigation */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/teacher/students">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Students
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold text-foreground">Import Students</h1>
          <p className="mt-1 text-body text-foreground-secondary">
            Bulk import students into {selectedOrganization.organizationName}
          </p>
        </div>
        <Badge variant="primary" size="md">
          CSV Import
        </Badge>
      </div>

      {/* Instructions Card */}
      <Card elevation="sm" className="bg-info-subtle/30 border-info-subtle">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-info mt-0.5" />
            <div className="space-y-2">
              <p className="font-medium text-foreground">CSV Format Requirements</p>
              <p className="text-sm text-foreground-secondary">
                Your CSV file must include a header row with these columns:
              </p>
              <code className="block bg-surface px-3 py-2 rounded text-sm font-mono text-foreground">
                student_login,first_name,last_name,class_code,organization_slug,pin
              </code>
              <ul className="text-sm text-foreground-secondary space-y-1 list-disc list-inside">
                <li>student_login: Unique identifier (e.g., ST-123456)</li>
                <li>first_name, last_name: Student&apos;s name (min 2 characters each)</li>
                <li>class_code: Active join code for the target class</li>
                <li>
                  organization_slug: Must match &quot;{selectedOrganization.organizationSlug}&quot;
                </li>
                <li>pin: 4-6 digit numeric PIN for student login</li>
              </ul>
              <div className="flex gap-3 mt-3">
                <DownloadTemplateButton organizationSlug={selectedOrganization.organizationSlug} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {importError && (
        <Card elevation="sm" className="bg-error-subtle/30 border-error-subtle">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-error mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Import Error</p>
                <p className="text-sm text-foreground-secondary mt-1">{importError}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Card elevation="sm" className="bg-success-subtle/30 border-success-subtle">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-foreground">Import Complete</p>
                <div className="text-sm text-foreground-secondary space-y-1">
                  <p>Total processed: {importResult.totalProcessed}</p>
                  <p>New profiles created: {importResult.profilesCreated}</p>
                  <p>Existing profiles used: {importResult.existingProfilesUsed}</p>
                  {importResult.failed > 0 && (
                    <p className="text-error">Failed: {importResult.failed}</p>
                  )}
                </div>
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-foreground">Errors:</p>
                    <ul className="text-sm text-foreground-secondary list-disc list-inside">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>
                          {err.studentLogin}: {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Form */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Section */}
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>Upload CSV</CardTitle>
            </div>
            <CardDescription>
              Upload a CSV file or paste the content directly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload Area */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">CSV File</label>
              <div
                className={`border-2 border-dashed rounded-card p-8 text-center transition-colors ${
                  dragActive
                    ? "border-primary bg-primary-subtle/20"
                    : "border-border hover:border-border-hover"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <FileSpreadsheet className="h-8 w-8 mx-auto text-foreground-secondary mb-3" />
                <p className="text-sm text-foreground-secondary mb-2">
                  Drag and drop your CSV file here, or click to browse
                </p>
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  id="csv-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => document.getElementById("csv-file-input")?.click()}
                >
                  Choose File
                </Button>
              </div>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface-raised px-2 text-foreground-secondary">
                  Or paste content
                </span>
              </div>
            </div>

            {/* Text Area */}
            <div className="space-y-2">
              <label htmlFor="csv-text" className="text-sm font-medium text-foreground">
                CSV Content
              </label>
              <textarea
                id="csv-text"
                rows={8}
                value={csvContent}
                onChange={(e) => handleTextChange(e.target.value)}
                className="w-full rounded-card border border-border bg-surface-raised px-4 py-3 text-sm font-mono text-foreground placeholder:text-foreground-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-focus"
                placeholder={`student_login,first_name,last_name,class_code,organization_slug,pin\nST-100001,John,Doe,ABC123,${selectedOrganization.organizationSlug},1234\nST-100002,Jane,Smith,ABC123,${selectedOrganization.organizationSlug},5678`}
              />
              <p className="text-xs text-foreground-secondary">
                Paste CSV content directly. Each row represents one student.
              </p>
            </div>

            {/* Validation Summary */}
            {parsedData && stats && (
              <div
                className={`rounded-card border p-4 ${
                  stats.invalid > 0
                    ? "border-warning-subtle bg-warning-subtle/20"
                    : "border-success-subtle bg-success-subtle/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Eye className="h-5 w-5 text-foreground-secondary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground text-sm">Preview & Validation</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="success" size="sm">
                        {stats.valid} Valid
                      </Badge>
                      <Badge variant="warning" size="sm">
                        {stats.warning} Warnings
                      </Badge>
                      <Badge variant="error" size="sm">
                        {stats.invalid} Errors
                      </Badge>
                    </div>
                    {!parsedData.headersValid && (
                      <div className="mt-2 text-sm text-error">
                        {parsedData.headerErrors.map((err, i) => (
                          <p key={i}>{err}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <CardFooter className="px-0 pt-2 pb-0">
              <div className="flex w-full gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  asChild
                  className="flex-1"
                  disabled={isImporting}
                >
                  <Link href="/teacher/students">Cancel</Link>
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleImport}
                  disabled={
                    isImporting || !parsedData || stats?.valid === 0 || !parsedData.headersValid
                  }
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Students
                    </>
                  )}
                </Button>
              </div>
            </CardFooter>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card elevation="sm" className="lg:h-fit">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>Preview</CardTitle>
            </div>
            <CardDescription>
              {stats ? (
                <span>
                  Showing {stats.total} rows: {stats.valid} valid, {stats.warning} warnings,{" "}
                  {stats.invalid} errors
                </span>
              ) : (
                "Preview of students to be imported"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!parsedData || parsedData.rows.length === 0 ? (
              <EmptyState
                icon={<FileSpreadsheet className="h-6 w-6" />}
                title="No Data to Preview"
                description="Upload a CSV file or paste content to see a preview of the import."
              />
            ) : (
              <div className="space-y-4">
                <div className="border rounded-card overflow-hidden max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead density="compact">Line</TableHead>
                        <TableHead density="compact">Login</TableHead>
                        <TableHead density="compact">Name</TableHead>
                        <TableHead density="compact">Class</TableHead>
                        <TableHead density="compact">PIN</TableHead>
                        <TableHead density="compact">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.rows.map((row) => (
                        <TableRow key={row.lineNumber}>
                          <TableCell density="compact" className="text-foreground-secondary">
                            {row.lineNumber}
                          </TableCell>
                          <TableCell density="compact" className="font-mono text-xs">
                            {row.studentLogin || "—"}
                          </TableCell>
                          <TableCell density="compact">
                            {row.firstName || row.lastName
                              ? `${row.firstName} ${row.lastName}`.trim()
                              : "—"}
                          </TableCell>
                          <TableCell density="compact" className="font-mono text-xs">
                            {row.classCode || "—"}
                          </TableCell>
                          <TableCell density="compact" className="font-mono text-xs">
                            {row.pin ? "••••" : "—"}
                          </TableCell>
                          <TableCell density="compact">
                            <Badge variant={getStatusBadgeVariant(row.status)} size="sm">
                              {row.status}
                            </Badge>
                            {row.errors.length > 0 && (
                              <div className="text-xs text-error mt-1">
                                {row.errors.map((e) => e.message).join(", ")}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Import Behavior Info */}
      <Card elevation="sm" className="bg-surface-muted/50">
        <CardHeader>
          <CardTitle className="text-base">How Import Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground-secondary">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground">New students</strong> — If the student_login
              doesn&apos;t exist, a new profile is created with the provided PIN.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground">Existing students</strong> — If the
              student_login exists and the PIN matches, the student is enrolled in the specified
              class.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <X className="h-4 w-4 text-error shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground">Duplicates</strong> — If a student is already
              enrolled in the target class, they are skipped and marked as duplicate.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground">Errors</strong> — Rows with invalid data (wrong
              PIN format, missing fields, invalid class codes) are reported but don&apos;t stop the
              import.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
