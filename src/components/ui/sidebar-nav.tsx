"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavItem, UserRole } from "@/components/ui/nav-item";

type NavItemTuple = readonly [string, string];

interface SidebarNavProps {
  navItems: readonly NavItemTuple[];
  role: UserRole;
  notificationsSlot?: React.ReactNode;
}

/**
 * SidebarNav Component
 *
 * Client-side navigation sidebar that correctly determines active state
 * using usePathname() from next/navigation.
 *
 * Replaces broken server-side header-based pathname detection.
 */
export function SidebarNav({ navItems, role, notificationsSlot }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1">
      {navItems.map(([href, label]) => {
        const isOverview = href === `/${role}`;
        const isActive = isOverview
          ? pathname === href
          : pathname === href || pathname?.startsWith(href + "/");
        const isNotifications = href === `/${role}/notifications`;

        return (
          <NavItem
            key={href}
            asChild
            role={role}
            active={isActive}
          >
            <Link href={href} className="flex items-center gap-1">
              {label}
              {isNotifications && notificationsSlot}
            </Link>
          </NavItem>
        );
      })}
    </nav>
  );
}
