/** "2026-09-25" → Date at the start / end of that day in Dubai time. */
export function dubaiDayStart(d?: string | null): Date | null {
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00+04:00`) : null;
}

export function dubaiDayEnd(d?: string | null): Date | null {
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T23:59:59.999+04:00`) : null;
}

/** A date typed in a form (yyyy-mm-dd) is stored at midday Dubai time, safely inside that day. */
export function dubaiMidday(d: string): Date {
  return new Date(`${d}T12:00:00+04:00`);
}

/** Calendar date (yyyy-mm-dd) of a Date in Dubai time. */
export function dubaiDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(d);
}
