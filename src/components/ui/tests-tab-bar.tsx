"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { t } from "@/lib/translations";

const tabs = [
  { label: t.components.testsTabBar.tests, href: "/teacher/tests" },
  { label: t.components.testsTabBar.questionBank, href: "/teacher/tests/bank" },
];

/**
 * TestsTabBar Component
 *
 * Horizontal tab bar for navigating between Tests and Question Bank pages.
 * Uses usePathname() to determine active state.
 */
export function TestsTabBar() {
  const pathname = usePathname();

  return (
    <div className="border-b border-border">
      <nav className="flex gap-1" aria-label={t.components.testsTabBar.navigation}>
        {tabs.map((tab) => {
          const isActive = tab.href === "/teacher/tests"
            ? pathname === tab.href || (pathname?.startsWith(tab.href + "/") && !pathname?.startsWith("/teacher/tests/bank"))
            : pathname === tab.href || pathname?.startsWith(tab.href + "/");

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative px-4 py-3 text-body-sm font-medium",
                "text-foreground-secondary transition-colors duration-fast ease-default",
                "hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}