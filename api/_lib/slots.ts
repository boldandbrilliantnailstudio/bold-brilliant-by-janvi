// Booking slot rules shared by the booking endpoint: builds the day's slots from Admin >
// Booking Settings and counts existing (non-cancelled) bookings per slot.
import { dbFetch } from "./db.js";

export type BookingSettings = {
  working_days: number[];
  open_time: string;
  close_time: string;
  slot_minutes: number;
  per_slot: number;
  holidays: string[];
};

type Env = { supabaseUrl: string; serviceKey: string };

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export async function loadSettings(env: Env): Promise<BookingSettings | null> {
  const r = await dbFetch(env.supabaseUrl, env.serviceKey, "booking_settings?id=eq.1&select=*");
  return ((await r.json()) as BookingSettings[])[0] ?? null;
}

// All slot start times ("HH:MM") for a date, or [] when closed (holiday / non-working day).
export function slotsFor(s: BookingSettings, date: string): string[] {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (!s.working_days.includes(weekday) || s.holidays.includes(date)) return [];
  const out: string[] = [];
  const step = Math.max(15, s.slot_minutes);
  for (let m = toMin(s.open_time); m + step <= toMin(s.close_time); m += step) out.push(toTime(m));
  return out;
}

// Bookings per slot time on a date, ignoring cancelled ones.
export async function takenCounts(env: Env, date: string): Promise<Record<string, number>> {
  const r = await dbFetch(
    env.supabaseUrl,
    env.serviceKey,
    `bookings?preferred_date=eq.${date}&status=neq.Cancelled&select=preferred_time`,
  );
  const rows = (await r.json()) as { preferred_time: string }[];
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const t = row.preferred_time.slice(0, 5);
    counts[t] = (counts[t] ?? 0) + 1;
  }
  return counts;
}

// Free slots for customers: slots with room left (and not already past today in IST).
export async function freeSlots(env: Env, s: BookingSettings, date: string, nowIst: Date): Promise<string[]> {
  const counts = await takenCounts(env, date);
  const today = nowIst.toISOString().slice(0, 10);
  const nowMin = nowIst.getUTCHours() * 60 + nowIst.getUTCMinutes();
  return slotsFor(s, date).filter((t) => (counts[t] ?? 0) < s.per_slot && (date !== today || toMin(t) > nowMin));
}
