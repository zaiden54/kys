/**
 * Shared disposable-test-user helpers for every E2E spec in this suite.
 * Mirrors scripts/verify-auth-security.mjs's uniqueEmail/cleanup pattern so
 * repeated local runs never accumulate rows.
 *
 * deleteUserByEmail's DELETE targets only the `user` row: every other table
 * this app writes to (salary_history, payment_schedule, ytd_baseline,
 * bonuses, vacations) declares its userId FK with `onDelete: "cascade"` (see
 * src/lib/db/schema.ts and src/lib/db/auth-schema.ts), so deleting the user
 * row alone is sufficient cleanup.
 *
 * T-07-03 mitigation: `email` here is always this fixture's own freshly
 * generated `uniqueEmail()` output, never user input, so this raw DELETE can
 * only ever remove rows this same test run created.
 */
import { neon } from "@neondatabase/serverless";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

export async function deleteUserByEmail(email: string): Promise<void> {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`delete from "user" where email = ${email}`;
}
