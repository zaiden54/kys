import {
  bigint,
  boolean,
  check,
  date,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";

// salary_history: effective-dated, immutable-until-collision facts about a
// user's gross salary. D-12/D-13/D-14: backdating allowed, exact-date
// collisions overwrite (see repository layer in a later plan).
export const salaryHistory = pgTable(
  "salary_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // bigint kopecks — a 32-bit integer column overflows at ~21.47M rub,
    // well within this app's own top NDFL bracket (20M-50M+ rub).
    grossAmountKopecks: bigint("gross_amount_kopecks", { mode: "number" }).notNull(),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("salary_history_user_effective_from_uq").on(
      table.userId,
      table.effectiveFrom,
    ),
  ],
);

// payment_schedule: one current row per user — D-01 stores day-of-month
// numbers, no schedule history is retained (SAL-02 only asks for salary
// history, not schedule history).
export const paymentSchedule = pgTable(
  "payment_schedule",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    avansDay: integer("avans_day").notNull(),
    salaryDay: integer("salary_day").notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    check("avans_day_range", sql`${table.avansDay} >= 1 AND ${table.avansDay} <= 31`),
    check("salary_day_range", sql`${table.salaryDay} >= 1 AND ${table.salaryDay} <= 31`),
  ],
);

// ytd_baseline: single mutable "opening balance" row per user for the
// cumulative-income tax engine to fold forward from (D-09/D-10/D-11) — not
// a competing ledger of events.
export const ytdBaseline = pgTable("ytd_baseline", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  amountKopecks: bigint("amount_kopecks", { mode: "number" }).notNull().default(0),
  asOfDate: date("as_of_date", { mode: "string" }).notNull(),
  isEstimated: boolean("is_estimated").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});
