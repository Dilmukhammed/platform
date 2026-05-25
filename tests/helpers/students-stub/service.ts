import { getClassesState, getTeacherClassDetail, listTeacherClasses, type ClassEnrollmentRecord } from "../classes-stub";
import { getJoinCodesState, isValidJoinCodeFormat } from "@/modules/join-codes";
import { getOrganizationsState, getTeacherSelectedOrganization } from "../organizations-stub";
import { comparePin, hashPin, isBcryptHash, isMd5Hash } from "@/lib/crypto/pin-hash";

import { getStudentsState } from "./store";
import type {
  BulkImportResult,
  BulkImportRowResult,
  ManualStudentCreateResult,
  OrganizationStudentRecord,
  ProvisionedStudentSummary,
  SelfJoinResult,
  StudentAuthLookup,
  StudentCredentialRecord,
  StudentProfileRecord,
  StudentProvisioningSource,
} from "./types";

const STUDENT_LOGIN_PATTERN = /^ST-(\d{6})$/;
const PIN_PATTERN = /^\d{4}$/;

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeStudentLogin(studentLogin: string) {
  return normalizeWhitespace(studentLogin).toUpperCase();
}

function buildDisplayName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

function validatePersonName(value: string, label: string) {
  const normalized = normalizeWhitespace(value);

  if (normalized.length < 2) {
    throw new Error(`${label} must be at least 2 characters.`);
  }

  return normalized;
}

function validatePin(pin: string) {
  const normalized = pin.trim();

  if (!PIN_PATTERN.test(normalized)) {
    throw new Error("PIN must be exactly 4 numeric digits.");
  }

  return normalized;
}

function nextStudentId(profiles: StudentProfileRecord[]) {
  return `50000000-0000-4000-8000-${String(profiles.length + 1).padStart(12, "0")}`;
}

function nextCredentialId(credentials: StudentCredentialRecord[]) {
  return `52000000-0000-4000-8000-${String(credentials.length + 1).padStart(12, "0")}`;
}

function nextOrganizationStudentId(records: OrganizationStudentRecord[]) {
  return `53000000-0000-4000-8000-${String(records.length + 1).padStart(12, "0")}`;
}

function nextEnrollmentId(enrollments: ClassEnrollmentRecord[]) {
  return `61000000-0000-4000-8000-${String(enrollments.length + 1).padStart(12, "0")}`;
}

function parseStudentLoginCounter(studentLogin: string) {
  const match = studentLogin.match(STUDENT_LOGIN_PATTERN);
  return match ? Number(match[1]) : 0;
}

function getStudentProfileById(studentId: string) {
  return getStudentsState().profiles.find((profile) => profile.id === studentId) ?? null;
}

function getStudentProfileByLogin(studentLogin: string) {
  return getStudentsState().profiles.find((profile) => profile.studentLogin === normalizeStudentLogin(studentLogin)) ?? null;
}

function getCredentialByStudentId(studentId: string) {
  return getStudentsState().credentials.find((credential) => credential.studentId === studentId) ?? null;
}

function getOrganizationName(organizationId: string) {
  const organization = getOrganizationsState().organizations.find((candidate) => candidate.id === organizationId);

  if (!organization) {
    throw new Error("Organization record is missing.");
  }

  return organization.name;
}

function requireSelectedTeacherOrganization(teacherId: string) {
  const selectedOrganization = getTeacherSelectedOrganization(teacherId);

  if (!selectedOrganization) {
    throw new Error("Select an approved organization before managing students.");
  }

  return selectedOrganization;
}

function ensureTeacherManagedClass(input: { teacherId: string; classId: string }) {
  const selectedOrganization = requireSelectedTeacherOrganization(input.teacherId);
  const classDetail = getTeacherClassDetail(input);

  if (classDetail.organizationId !== selectedOrganization.organizationId) {
    throw new Error("Selected class is outside the active organization.");
  }

  return classDetail;
}

function generateDeterministicStudentLogin() {
  const state = getStudentsState();
  const nextCounter = state.profiles.reduce((max, profile) => Math.max(max, parseStudentLoginCounter(profile.studentLogin)), 100000) + 1;
  return `ST-${String(nextCounter).padStart(6, "0")}`;
}

function ensureExplicitLoginAvailable(studentLogin: string) {
  const normalized = normalizeStudentLogin(studentLogin);

  if (!STUDENT_LOGIN_PATTERN.test(normalized)) {
    throw new Error("Student login must follow the ST-123456 format.");
  }

  if (getStudentProfileByLogin(normalized)) {
    throw new Error(`Student login ${normalized} already exists.`);
  }

  return normalized;
}

async function createStudentProfile(input: {
  studentLogin: string;
  firstName: string;
  lastName: string;
  pin: string;
  createdAt?: string;
}) {
  const state = getStudentsState();
  const firstName = validatePersonName(input.firstName, "First name");
  const lastName = validatePersonName(input.lastName, "Last name");
  const pin = validatePin(input.pin);
  const timestamp = input.createdAt ?? new Date().toISOString();

  const profile: StudentProfileRecord = {
    id: nextStudentId(state.profiles),
    studentLogin: input.studentLogin,
    firstName,
    lastName,
    displayName: buildDisplayName(firstName, lastName),
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const credential: StudentCredentialRecord = {
    id: nextCredentialId(state.credentials),
    studentId: profile.id,
    pinHash: await hashPin(pin),
    status: "active",
    lastPinChangedAt: timestamp,
  };

  state.profiles.push(profile);
  state.credentials.push(credential);

  return { profile, credential };
}

function ensureOrganizationStudent(input: { organizationId: string; studentId: string; createdAt?: string }) {
  const state = getStudentsState();
  const existing = state.organizationStudents.find(
    (record) => record.organizationId === input.organizationId && record.studentId === input.studentId,
  );

  if (existing) {
    return existing;
  }

  const record: OrganizationStudentRecord = {
    id: nextOrganizationStudentId(state.organizationStudents),
    organizationId: input.organizationId,
    studentId: input.studentId,
    status: "active",
    joinedAt: input.createdAt ?? new Date().toISOString(),
  };

  state.organizationStudents.push(record);
  return record;
}

function attachEnrollment(input: { classId: string; studentId: string; source: StudentProvisioningSource; joinedAt?: string }) {
  const classesState = getClassesState();
  const student = getStudentProfileById(input.studentId);

  if (!student) {
    throw new Error("Student profile is missing.");
  }

  const existing = classesState.enrollments.find(
    (record) => record.classId === input.classId && record.studentId === input.studentId,
  );

  if (existing) {
    return { enrollment: existing, created: false };
  }

  const enrollment: ClassEnrollmentRecord = {
    id: nextEnrollmentId(classesState.enrollments),
    classId: input.classId,
    studentId: input.studentId,
    studentDisplayName: student.displayName,
    studentLogin: student.studentLogin,
    joinedAt: input.joinedAt ?? new Date().toISOString(),
    enrollmentSource: input.source,
  };

  classesState.enrollments.push(enrollment);
  return { enrollment, created: true };
}

function resolvePublicJoinClass(joinCode: string) {
  const normalizedCode = normalizeWhitespace(joinCode);

  if (!isValidJoinCodeFormat(normalizedCode)) {
    throw new Error("Join code must be a 6-digit numeric value.");
  }

  const joinCodeRecord = getJoinCodesState().records.find(
    (record) => record.code === normalizedCode && record.status === "active",
  );

  if (!joinCodeRecord) {
    throw new Error("Join code was not found or is no longer active.");
  }

  const classRecord = getClassesState().classes.find((candidate) => candidate.id === joinCodeRecord.classId && candidate.status === "active");

  if (!classRecord) {
    throw new Error("The class behind this join code is unavailable.");
  }

  return {
    classId: classRecord.id,
    className: classRecord.name,
    organizationId: classRecord.organizationId,
    organizationName: getOrganizationName(classRecord.organizationId),
  };
}

function parseCsvLine(line: string) {
  return line.split(",").map((segment) => segment.trim());
}

function assertCsvHeaders(headers: string[]) {
  const expectedHeaders = ["student_login", "first_name", "last_name", "class_code", "organization_slug", "pin"];

  if (headers.length !== expectedHeaders.length || headers.some((header, index) => header !== expectedHeaders[index])) {
    throw new Error("CSV header must be: student_login,first_name,last_name,class_code,organization_slug,pin");
  }
}

export function getStudentAuthLookup(studentLogin: string): StudentAuthLookup | null {
  const profile = getStudentProfileByLogin(studentLogin);

  if (!profile) {
    return null;
  }

  const credential = getCredentialByStudentId(profile.id);

  if (!credential) {
    return null;
  }

  return {
    id: profile.id,
    studentLogin: profile.studentLogin,
    displayName: profile.displayName,
    pinHash: credential.pinHash,
    status: credential.status,
  };
}

export function getLatestBulkImportReport() {
  const report = getStudentsState().latestBulkImportReport;

  return report
    ? {
        ...report,
        rows: report.rows.map((row) => ({ ...row })),
      }
    : null;
}

export function listTeacherStudents(
  teacherId: string,
  _options?: { page?: number; pageSize?: number },
): { students: ProvisionedStudentSummary[]; total: number } {
  const students = getStudentsState().enrollments
    .filter((e) => e.teacherId === teacherId && e.status === "active")
    .map((e) => {
      const profile = getStudentsState().profiles.find((p) => p.id === e.studentProfileId);
      if (!profile) return null;
      return {
        enrollmentId: e.id,
        studentProfileId: profile.id,
        studentLogin: profile.studentLogin,
        firstName: profile.firstName,
        lastName: profile.lastName,
        middleName: profile.middleName,
        displayName: profile.displayName,
        studentStatus: profile.status,
        enrollmentStatus: e.status,
        classId: e.classId,
        className: e.className,
        joinedAt: e.joinedAt,
        leftAt: e.leftAt,
        source: e.source,
      } as ProvisionedStudentSummary;
    })
    .filter((s): s is ProvisionedStudentSummary => s !== null);
  return { students, total: students.length };
}

export async function createStudentForTeacher(input: {
  teacherId: string;
  classId: string;
  firstName: string;
  lastName: string;
  pin: string;
}): Promise<ManualStudentCreateResult> {
  const classDetail = ensureTeacherManagedClass({ teacherId: input.teacherId, classId: input.classId });
  const timestamp = new Date().toISOString();
  const { profile, credential } = await createStudentProfile({
    studentLogin: generateDeterministicStudentLogin(),
    firstName: input.firstName,
    lastName: input.lastName,
    pin: input.pin,
    createdAt: timestamp,
  });

  ensureOrganizationStudent({ organizationId: classDetail.organizationId, studentId: profile.id, createdAt: timestamp });
  attachEnrollment({ classId: classDetail.id, studentId: profile.id, source: "manual", joinedAt: timestamp });

  return {
    studentId: profile.id,
    studentLogin: profile.studentLogin,
    displayName: profile.displayName,
    assignedPin: input.pin,
    classId: classDetail.id,
    className: classDetail.name,
    organizationName: classDetail.organizationName,
  };
}

export async function selfJoinClass(input: {
  joinCode: string;
  existingStudentLogin?: string;
  firstName?: string;
  lastName?: string;
  pin: string;
}): Promise<SelfJoinResult> {
  const classContext = resolvePublicJoinClass(input.joinCode);
  const timestamp = new Date().toISOString();
  const existingLogin = normalizeStudentLogin(input.existingStudentLogin ?? "");
  const pin = validatePin(input.pin);

  if (existingLogin) {
    const student = getStudentAuthLookup(existingLogin);

    if (!student || student.status !== "active") {
      throw new Error("Student login was not found. Leave the login blank to create a new profile.");
    }

    const { matches } = await comparePin(pin, student.pinHash);
    if (!matches) {
      throw new Error("Student login or PIN is incorrect.");
    }

    ensureOrganizationStudent({ organizationId: classContext.organizationId, studentId: student.id, createdAt: timestamp });
    const enrollment = attachEnrollment({ classId: classContext.classId, studentId: student.id, source: "self_join", joinedAt: timestamp });

    return {
      result: enrollment.created ? "attached_existing" : "already_enrolled",
      studentId: student.id,
      studentLogin: student.studentLogin,
      displayName: student.displayName,
      classId: classContext.classId,
      className: classContext.className,
      organizationName: classContext.organizationName,
    };
  }

  const { profile } = await createStudentProfile({
    studentLogin: generateDeterministicStudentLogin(),
    firstName: input.firstName ?? "",
    lastName: input.lastName ?? "",
    pin,
    createdAt: timestamp,
  });

  ensureOrganizationStudent({ organizationId: classContext.organizationId, studentId: profile.id, createdAt: timestamp });
  attachEnrollment({ classId: classContext.classId, studentId: profile.id, source: "self_join", joinedAt: timestamp });

  return {
    result: "created_new",
    studentId: profile.id,
    studentLogin: profile.studentLogin,
    displayName: profile.displayName,
    classId: classContext.classId,
    className: classContext.className,
    organizationName: classContext.organizationName,
  };
}

export async function importStudentsFromCsv(input: { teacherId: string; csvText: string }): Promise<BulkImportResult> {
  const selectedOrganization = requireSelectedTeacherOrganization(input.teacherId);
  const lines = input.csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV file must include a header row and at least one student row.");
  }

  assertCsvHeaders(parseCsvLine(lines[0] ?? ""));

  const teacherClasses = listTeacherClasses(input.teacherId);
  const classCodeMap = new Map(teacherClasses.map((classSummary) => [classSummary.activeJoinCode, classSummary]));
  const importedAt = new Date().toISOString();
  const rows: BulkImportRowResult[] = [];
  let createdCount = 0;
  let attachedExistingCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  for (let index = 1; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const [studentLoginRaw = "", firstNameRaw = "", lastNameRaw = "", classCodeRaw = "", organizationSlugRaw = "", pinRaw = ""] = parseCsvLine(lines[index] ?? "");
    const studentLogin = normalizeStudentLogin(studentLoginRaw);
    const firstName = normalizeWhitespace(firstNameRaw);
    const lastName = normalizeWhitespace(lastNameRaw);
    const classCode = normalizeWhitespace(classCodeRaw);
    const organizationSlug = normalizeWhitespace(organizationSlugRaw).toLowerCase();

    try {
      const pin = validatePin(pinRaw);

      if (!studentLogin || !firstName || !lastName || !classCode || !organizationSlug) {
        throw new Error("Each CSV row must include login, first name, last name, class code, organization slug, and PIN.");
      }

      if (organizationSlug !== selectedOrganization.organizationSlug) {
        throw new Error(`Row organization ${organizationSlug} does not match the selected organization ${selectedOrganization.organizationSlug}.`);
      }

      const classSummary = classCodeMap.get(classCode);

      if (!classSummary) {
        throw new Error(`Class code ${classCode} is not active for the selected organization.`);
      }

      const existingStudent = getStudentProfileByLogin(studentLogin);

      if (existingStudent) {
        const credential = getCredentialByStudentId(existingStudent.id);

        if (!credential || credential.status !== "active") {
          throw new Error(`Student login ${studentLogin} is not active.`);
        }

        const { matches } = await comparePin(pin, credential.pinHash);
        if (!matches) {
          throw new Error(`PIN for existing student ${studentLogin} does not match the provisioned credential.`);
        }

        if (existingStudent.firstName !== firstName || existingStudent.lastName !== lastName) {
          throw new Error(`Student login ${studentLogin} already belongs to ${existingStudent.displayName}.`);
        }

        ensureOrganizationStudent({ organizationId: classSummary.organizationId, studentId: existingStudent.id, createdAt: importedAt });
        const enrollment = attachEnrollment({ classId: classSummary.id, studentId: existingStudent.id, source: "bulk_import", joinedAt: importedAt });

        if (enrollment.created) {
          attachedExistingCount += 1;
          rows.push({
            lineNumber,
            studentLogin,
            classCode,
            status: "attached_existing",
            message: `Attached existing student ${studentLogin} to ${classSummary.name}.`,
          });
        } else {
          duplicateCount += 1;
          rows.push({
            lineNumber,
            studentLogin,
            classCode,
            status: "duplicate",
            message: `Student ${studentLogin} is already enrolled in ${classSummary.name}.`,
          });
        }

        continue;
      }

      const { profile } = await createStudentProfile({
        studentLogin: ensureExplicitLoginAvailable(studentLogin),
        firstName,
        lastName,
        pin,
        createdAt: importedAt,
      });

      ensureOrganizationStudent({ organizationId: classSummary.organizationId, studentId: profile.id, createdAt: importedAt });
      attachEnrollment({ classId: classSummary.id, studentId: profile.id, source: "bulk_import", joinedAt: importedAt });
      createdCount += 1;
      rows.push({
        lineNumber,
        studentLogin,
        classCode,
        status: "created",
        message: `Created student ${studentLogin} and enrolled them in ${classSummary.name}.`,
      });
    } catch (error) {
      errorCount += 1;
      rows.push({
        lineNumber,
        studentLogin,
        classCode,
        status: "error",
        message: error instanceof Error ? error.message : "Bulk import row failed.",
      });
    }
  }

  const report: BulkImportResult = {
    importedAt,
    totalRows: rows.length,
    createdCount,
    attachedExistingCount,
    duplicateCount,
    errorCount,
    rows,
  };

  getStudentsState().latestBulkImportReport = {
    ...report,
    rows: report.rows.map((row) => ({ ...row })),
  };

  return report;
}
