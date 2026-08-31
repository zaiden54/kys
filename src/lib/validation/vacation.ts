import { differenceInCalendarDays } from "date-fns";
import { z } from "zod";

const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const isoDateString = z.string()
  .regex(ISO_DATE_SHAPE, "Дата должна быть в формате ГГГГ-ММ-ДД")
  .refine((value) => {
    if (!ISO_DATE_SHAPE.test(value)) return true;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, { message: "Указана несуществующая дата" });

// Mirrors bonusInputSchema's MAX_RUBLES cap (src/lib/validation/bonus.ts):
// a generous but bounded ceiling so a mistyped year (e.g. endDate a decade
// after startDate) or a direct Server Action call bypassing the client form
// can never persist an unbounded vacation range (closes 03-REVIEW.md WR-03).
// 366 covers any single calendar year including a leap year.
const MAX_VACATION_DAYS = 366;

export const vacationInputSchema = z.object({
  id: z.string().uuid("Некорректный идентификатор отпуска").optional(),
  startDate: isoDateString,
  endDate: isoDateString,
}).refine((data) => data.endDate >= data.startDate, {
  message: "Дата начала должна быть раньше даты окончания",
  path: ["endDate"],
}).refine((data) => {
  if (!ISO_DATE_SHAPE.test(data.startDate) || !ISO_DATE_SHAPE.test(data.endDate)) return true;
  const [startYear, startMonth, startDay] = data.startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = data.endDate.split("-").map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  return differenceInCalendarDays(end, start) + 1 <= MAX_VACATION_DAYS;
}, {
  message: `Отпуск не может длиться дольше ${MAX_VACATION_DAYS} дней`,
  path: ["endDate"],
});

export type VacationInput = z.infer<typeof vacationInputSchema>;
