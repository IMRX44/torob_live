/**
 * Opening hours. Dataset shape: { sat: { status, shifts: [{ start_time, end_time }] }, ... }.
 * "00:00-00:00" shifts are placeholders, and a shop with no real shift on any day
 * has simply not declared hours (the export marks those days "closed").
 */

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];
/** Iranian week order, for display. */
export const WEEK_ORDER: DayKey[] = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];
export const DAY_LABEL: Record<DayKey, string> = {
  sat: "شنبه",
  sun: "یکشنبه",
  mon: "دوشنبه",
  tue: "سه‌شنبه",
  wed: "چهارشنبه",
  thu: "پنجشنبه",
  fri: "جمعه",
};

/** Shift in minutes from local midnight; end may exceed 1440 for overnight shifts. */
export interface Shift {
  start: number;
  end: number;
}
export interface WeeklyHours {
  /** false when the shop never declared real hours. */
  known: boolean;
  days: Record<DayKey, Shift[] | null>; // null = unsupported/unknown for that day, [] = closed
}

interface RawDay {
  status?: string;
  shifts?: { start_time?: string; end_time?: string }[];
}

function toMin(t: string | undefined): number {
  if (!t) return 0;
  const [h = "0", m = "0"] = t.split(":");
  return Number(h) * 60 + Number(m);
}

export function parseWeeklyHours(raw: unknown): WeeklyHours {
  const obj = (typeof raw === "string" ? safeJson(raw) : raw) as Record<string, RawDay> | null;
  const days = Object.fromEntries(DAY_KEYS.map((d) => [d, null])) as WeeklyHours["days"];
  let known = false;
  if (!obj) return { known, days };
  for (const d of DAY_KEYS) {
    const day = obj[d];
    if (!day) continue;
    if (day.status === "closed") {
      days[d] = [];
      continue;
    }
    if (day.status !== "declared") continue; // unsupported → unknown
    const shifts: Shift[] = [];
    for (const s of day.shifts ?? []) {
      const start = toMin(s.start_time);
      let end = toMin(s.end_time);
      if (start === 0 && end === 0) continue;
      if (end <= start) end += 1440;
      shifts.push({ start, end });
    }
    shifts.sort((a, b) => a.start - b.start);
    days[d] = shifts;
    if (shifts.length) known = true;
  }
  if (!known) for (const d of DAY_KEYS) days[d] = null;
  return { known, days };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Tehran is UTC+03:30 with no DST since 2022. */
const TEHRAN_OFFSET_MIN = 210;

export function tehranClock(date: Date): { day: DayKey; minutes: number; dayIndex: number } {
  const local = new Date(date.getTime() + TEHRAN_OFFSET_MIN * 60_000);
  const dayIndex = local.getUTCDay();
  return { day: DAY_KEYS[dayIndex]!, dayIndex, minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

export type OpenStatus =
  | { state: "open"; closesAt: number; closingSoon: boolean }
  | { state: "closed"; opensAt: { day: DayKey; minutes: number; inDays: number } | null }
  | { state: "unknown" };

/** Status at a given instant, plus the next transition. */
export function openStatusAt(hours: WeeklyHours, date: Date): OpenStatus {
  if (!hours.known) return { state: "unknown" };
  const { dayIndex, minutes } = tehranClock(date);
  const today = hours.days[DAY_KEYS[dayIndex]!];
  const yesterday = hours.days[DAY_KEYS[(dayIndex + 6) % 7]!];
  // Overnight shift from yesterday still running.
  for (const s of yesterday ?? []) {
    if (s.end > 1440 && minutes < s.end - 1440) {
      return { state: "open", closesAt: s.end - 1440, closingSoon: s.end - 1440 - minutes <= 45 };
    }
  }
  if (today === null) return { state: "unknown" };
  for (const s of today) {
    if (minutes >= s.start && minutes < s.end) {
      return { state: "open", closesAt: s.end % 1440, closingSoon: s.end - minutes <= 45 };
    }
  }
  // Find next opening within a week.
  for (let i = 0; i < 7; i++) {
    const key = DAY_KEYS[(dayIndex + i) % 7]!;
    const shifts = hours.days[key];
    if (!shifts) continue;
    for (const s of shifts) {
      if (i > 0 || s.start > minutes) return { state: "closed", opensAt: { day: key, minutes: s.start, inDays: i } };
    }
  }
  return { state: "closed", opensAt: null };
}

/** Minutes the shop stays open after `date` (0 if closed/unknown). */
export function minutesUntilClose(hours: WeeklyHours, date: Date): number {
  const st = openStatusAt(hours, date);
  if (st.state !== "open") return 0;
  const { minutes } = tehranClock(date);
  const diff = st.closesAt - minutes;
  return diff >= 0 ? diff : diff + 1440;
}

export function todayShifts(hours: WeeklyHours, date: Date): Shift[] | null {
  return hours.days[tehranClock(date).day];
}
