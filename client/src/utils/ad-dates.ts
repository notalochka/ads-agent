/** Format ISO-ish date strings for display. */
export function formatAdDate(value: string | null | undefined): string {
  if (!value) return "n/a";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    // Already a short date string
    return value.slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

/**
 * Days the ad was/is observed:
 * - active + start only → days until today
 * - start + end → inclusive day span
 * - missing start → null
 */
export function calcObservedDays(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  status?: string,
): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;

  let end: Date;
  if (endDate) {
    end = new Date(endDate);
    if (Number.isNaN(end.getTime())) return null;
  } else if (status === "active" || !endDate) {
    end = new Date();
  } else {
    return null;
  }

  const ms = end.getTime() - start.getTime();
  if (ms < 0) return null;
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

export function statusLabel(status: string): string {
  if (status === "active") return "Active";
  if (status === "inactive") return "Inactive";
  return "Unknown";
}
