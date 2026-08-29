import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { bonuses } from "@/lib/db/schema";

export const bonusInsertSchema = createInsertSchema(bonuses);
const MAX_RUBLES = 100_000_000;
const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const isoDateString = z.string()
  .regex(ISO_DATE_SHAPE, "Дата должна быть в формате ГГГГ-ММ-ДД")
  .refine((value) => {
    if (!ISO_DATE_SHAPE.test(value)) return true;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, { message: "Указана несуществующая дата" });

export const bonusInputSchema = z.object({
  id: z.string().uuid("Некорректный идентификатор бонуса").optional(),
  amountRubles: z.coerce.number({ error: "Бонус должен быть числом" })
    .gt(0, "Бонус должен быть больше нуля")
    .max(MAX_RUBLES, "Бонус превышает допустимый максимум")
    .refine((value) => Math.round(value * 100) > 0, {
      message: "Бонус должен быть не меньше одной копейки",
    }),
  date: isoDateString,
  note: z.string().max(500, "Заметка слишком длинная (максимум 500 символов)")
    .optional().default(""),
});

export type BonusInput = z.infer<typeof bonusInputSchema>;
