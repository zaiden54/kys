import { z } from "zod";

const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const isoDateString = z.string()
  .regex(ISO_DATE_SHAPE, "Дата должна быть в формате ГГГГ-ММ-ДД")
  .refine((value) => {
    if (!ISO_DATE_SHAPE.test(value)) return true;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, { message: "Указана несуществующая дата" });

export const vacationInputSchema = z.object({
  id: z.string().uuid("Некорректный идентификатор отпуска").optional(),
  startDate: isoDateString,
  endDate: isoDateString,
}).refine((data) => data.endDate >= data.startDate, {
  message: "Дата начала должна быть раньше даты окончания",
  path: ["endDate"],
});

export type VacationInput = z.infer<typeof vacationInputSchema>;
