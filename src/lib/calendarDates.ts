const DAY_NAMES_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const MONTH_NAMES = [
  "Januar", "Februar", "Marts", "April", "Maj", "Juni",
  "Juli", "August", "September", "Oktober", "November", "December"
];

export { DAY_NAMES_SHORT, MONTH_NAMES };

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

export function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

/** Mandag = 0 ... søndag = 6, uanset JS's normale søndag-først. */
export function isoWeekday(d: Date): number {
  const jsDay = d.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Bygger alle celler til en måneds-kalender-grid, inklusiv udfyldnings-
 * dage fra forrige/næste måned, så gridet altid starter på en mandag og
 * har fulde uge-rækker.
 */
export function buildMonthGrid(year: number, month: number): Date[] {
  const first = startOfMonth(year, month);
  const last = endOfMonth(year, month);

  const leadingDays = isoWeekday(first);
  const gridStart = new Date(first);
  gridStart.setDate(gridStart.getDate() - leadingDays);

  const totalDaysShown = Math.ceil((leadingDays + last.getDate()) / 7) * 7;

  const days: Date[] = [];
  for (let i = 0; i < totalDaysShown; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

export function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

export function isSameDate(a: Date, b: Date): boolean {
  return toDateStr(a) === toDateStr(b);
}
