/**
 * Shared date formatting utilities.
 * Replaces 22+ duplicate formatDate/formatDateTime/formatRelativeTime
 * functions that were scattered across page components.
 */

/**
 * Format a date string as "Mon DD, YYYY" (e.g. "Jan 15, 2024").
 * Returns "—" for null, undefined, empty, or invalid date strings.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("uz-UZ", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a date string with time as "Mon DD, YYYY, HH:MM" (e.g. "Jan 15, 2024, 03:45 PM").
 * Returns "—" for null, undefined, empty, or invalid date strings.
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("uz-UZ", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a date string as a relative time (e.g. "5m ago", "2h ago", "3d ago").
 * Falls back to formatDate for dates older than 7 days.
 * Returns "—" for null, undefined, empty, or invalid date strings.
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Hozir";
  if (diffMins < 60) return `${diffMins} daq oldin`;
  if (diffHours < 24) return `${diffHours} soat oldin`;
  if (diffDays < 7) return `${diffDays} kun oldin`;
  return formatDate(dateString);
}
