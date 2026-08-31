/**
 * Pure Moscow-time anchoring helpers (closes 01-VERIFICATION.md gap 2 /
 * CR-01: no file in this codebase anchored "today" to Europe/Moscow, so the
 * app could show the wrong next-payment date for roughly the first three
 * hours of every Moscow calendar day, on every deployment).
 *
 * Fixed UTC+3 offset, no DST branch: Russia abolished seasonal clock changes
 * in 2014, so Europe/Moscow is a fixed UTC+3 year-round. A hand-rolled
 * offset is therefore exactly as correct as a tz-database lookup for this
 * timezone, and avoids adding `date-fns-tz` as a new dependency for zero
 * correctness gain.
 *
 * `nowInMoscow()` returns a **wall-clock carrier, not a true instant** — its
 * epoch value is deliberately not the real current time. Its LOCAL
 * accessors (`getFullYear`, `getMonth`, `getDate`, `getHours`, ...) read
 * Moscow's wall clock in ANY host process timezone, which is what every
 * consumer in this app actually reads (e.g.
 * `src/domain/schedule/resolve-payment-date.ts`'s `nextPaymentOnOrAfter`
 * calls `today.getFullYear()`/`today.getMonth()`/`startOfDay(today)`, all
 * local accessors, and builds dates with the local
 * `new Date(year, monthIndex, day)` form). Handing this value to that
 * pipeline is safe. This value must NEVER be written to a database
 * timestamp column — only true UTC instants (`new Date()`) belong there.
 *
 * Permitted imports: none beyond TypeScript's own types, matching
 * `src/domain/money.ts` — this module must remain importable from any
 * context (server, client, tests) without pulling in Next.js, React, or any
 * I/O surface. Unlike `src/lib/db/salary-repository.ts` and
 * `src/app/actions/forecast.ts`, this module carries NO server-only guard:
 * it is imported directly into the `"use client"` component
 * `src/components/pay-setup-forms.tsx`.
 */

const MOSCOW_UTC_OFFSET_MINUTES = 180;

/** The plain calendar/wall-clock fields Moscow's local clock reads at a given instant. */
interface MoscowFields {
  year: number;
  /** 0-indexed, matching `Date#getMonth()`. */
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

/**
 * Derives Moscow's wall-clock fields for `instant` without depending on the
 * host process's timezone: shifts the epoch forward by the fixed UTC+3
 * offset, then reads the shifted instant's UTC accessors (which are always
 * timezone-independent). Both exports below derive from this one helper so
 * they can never disagree.
 */
function moscowFieldsAt(instant: Date): MoscowFields {
  const shifted = new Date(instant.getTime() + MOSCOW_UTC_OFFSET_MINUTES * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
    milliseconds: shifted.getUTCMilliseconds(),
  };
}

/**
 * Returns a wall-clock carrier `Date` whose LOCAL accessors read Moscow's
 * current wall-clock fields, in any host process timezone. See the module
 * doc comment for why this is the correct shape and why it must never be
 * written to a timestamp column.
 */
export function nowInMoscow(): Date {
  const fields = moscowFieldsAt(new Date());
  return new Date(
    fields.year,
    fields.month,
    fields.day,
    fields.hours,
    fields.minutes,
    fields.seconds,
    fields.milliseconds,
  );
}

/**
 * Returns today's date in Europe/Moscow as a zero-padded `yyyy-MM-dd`
 * string, derived directly from the wall-clock fields (never by converting
 * a Date back through an ISO serialiser, which would reintroduce a
 * host-timezone dependency).
 */
export function todayIsoInMoscow(): string {
  const fields = moscowFieldsAt(new Date());
  const year = String(fields.year).padStart(4, "0");
  const month = String(fields.month + 1).padStart(2, "0");
  const day = String(fields.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats a `yyyy-MM-dd` string as a Russian-locale long date (e.g.
 * "15 сентября 2026 г."). Extracted from three call sites that previously
 * defined this verbatim (`bonus-row.tsx`, `vacation-row.tsx`,
 * `next-payment-card.tsx` — closes 03-REVIEW.md WR-02) so a future locale or
 * formatting change only needs to happen once.
 *
 * Builds the `Date` from local year/month/day components (never
 * `new Date(isoDate)`, which parses as UTC midnight and can display the
 * wrong calendar day in a host timezone behind UTC) purely to hand it to
 * `Intl.DateTimeFormat`, which only reads local accessors — this is safe
 * regardless of host process timezone.
 */
export function formatIsoDateRu(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
