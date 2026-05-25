import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { t } from "@/lib/translations";

const root = process.cwd();

const expectedAppFiles = [
  "src/app/layout.tsx",
  "src/app/globals.css",
  "src/app/(public)/layout.tsx",
  "src/app/(public)/page.tsx",
  "src/app/(public)/join/page.tsx",
  "src/app/(public)/organization/request/page.tsx",
  "src/app/(public)/auth/teacher/sign-in/page.tsx",
  "src/app/(public)/auth/teacher/sign-up/page.tsx",
  "src/app/(public)/auth/teacher/invite/accept/page.tsx",
  "src/app/(public)/auth/student/login/page.tsx",
  "src/app/(teacher)/teacher/layout.tsx",
  "src/app/(teacher)/teacher/page.tsx",
  "src/app/(student)/student/layout.tsx",
  "src/app/(student)/student/page.tsx",
  "src/app/(admin)/admin/layout.tsx",
  "src/app/(admin)/admin/page.tsx",
];

const expectedModuleScopes = [
  "auth",
  "organizations",
  "teachers",
  "students",
  "classes",
  "join-codes",
  "materials",
  "tests",
  "assignments",
  "publications",
  "submissions",
  "reviews",
  "annotations",
  "grades",
  "notifications",
  "ai",
];

const expectedFixtureFiles = [
  "supabase/config.toml",
  "supabase/seed.sql",
  "fixtures/students/sample.csv",
  "fixtures/submissions/sample.jpg",
  "fixtures/submissions/sample.pdf",
  "fixtures/submissions/sample.dwg",
];

function fromRoot(relativePath: string) {
  return path.join(root, relativePath);
}

describe("T0.1 bootstrap scaffold", () => {
  test("contains required app router scaffold for all route groups", () => {
    for (const relativePath of expectedAppFiles) {
      expect(existsSync(fromRoot(relativePath))).toBe(true);
    }

    const publicHome = readFileSync(fromRoot("src/app/(public)/page.tsx"), "utf8");
    expect(publicHome).toContain(t.public.landing.badge);
    expect(publicHome).toContain('href="/auth/teacher/sign-in"');
    expect(publicHome).toContain('href="/auth/student/login"');
  });

  test("keeps role layouts and starter modules aligned with the plan structure", () => {
    const teacherLayout = readFileSync(fromRoot("src/app/(teacher)/teacher/layout.tsx"), "utf8");
    const studentLayout = readFileSync(fromRoot("src/app/(student)/student/layout.tsx"), "utf8");
    const adminLayout = readFileSync(fromRoot("src/app/(admin)/admin/layout.tsx"), "utf8");

    expect(teacherLayout).toContain('"/teacher/assignments"');
    expect(studentLayout).toContain('"/student/results"');
    expect(adminLayout).toContain('"/admin/material-approvals"');

    for (const scope of expectedModuleScopes) {
      const modulePath = fromRoot(`src/modules/${scope}/index.ts`);
      expect(existsSync(modulePath)).toBe(true);

      const source = readFileSync(modulePath, "utf8");
      expect(source).toContain(`scope: "${scope}"`);
      // Organizations module has been migrated to production-ready (no more in-memory stubs)
      const validStatuses = ["bootstrap-ready", "production-ready", "supabase-migrated"];
      const statusMatch = source.match(/status:\s*"([^"]+)"/);
      expect(statusMatch).not.toBeNull();
      expect(validStatuses).toContain(statusMatch![1]);
    }
  });

  test("keeps package bootstrap scripts and Next.js build dependency in place", () => {
    const packageJson = JSON.parse(readFileSync(fromRoot("package.json"), "utf8")) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.scripts?.dev).toBe("next dev");
    expect(packageJson.scripts?.build).toBe("next build");
    expect(packageJson.dependencies?.next).toBeDefined();
    expect(packageJson.devDependencies?.typescript).toBeDefined();
  });

  test("ships deterministic Supabase seed and QA fixture assets", () => {
    for (const relativePath of expectedFixtureFiles) {
      const absolutePath = fromRoot(relativePath);
      expect(existsSync(absolutePath)).toBe(true);
      expect(statSync(absolutePath).size).toBeGreaterThan(0);
    }

    const seed = readFileSync(fromRoot("supabase/seed.sql"), "utf8");
    expect(seed).toContain("admin@platform.local");
    expect(seed).toContain("teacher@platform.local");
    expect(seed).toContain("ST-100001");
    expect(seed).toContain("demo-school");
    expect(seed).toContain("120801");
    expect(seed).toContain("120802");
    expect(seed).toContain("Orthographic Projection Basics");

    const studentCsv = readFileSync(fromRoot("fixtures/students/sample.csv"), "utf8");
    expect(studentCsv).toContain("student_login,first_name,last_name,class_code,organization_slug,pin");
    expect(studentCsv).toContain("ST-100001");
  });
});
