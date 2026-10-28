// server-only guard equivalent — see src/lib/session.ts.
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/db/avatar-repository.ts is server-only and must never be imported into a client component.",
  );
}

/**
 * Ownership-scoped access to user_avatar. As in the other repositories,
 * every function takes `userId` (from `requireUserId()`) first and filters
 * on it.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userAvatar } from "@/lib/db/schema";
import type { AvatarContentType } from "@/lib/validation/profile";

export type AvatarRow = typeof userAvatar.$inferSelect;

export async function upsertAvatar(
  userId: string,
  contentType: AvatarContentType,
  data: string,
): Promise<AvatarRow> {
  const updatedAt = new Date();
  const [row] = await db
    .insert(userAvatar)
    .values({ userId, contentType, data, updatedAt })
    .onConflictDoUpdate({
      target: userAvatar.userId,
      set: { contentType, data, updatedAt },
    })
    .returning();
  return row;
}

export async function getAvatar(userId: string): Promise<AvatarRow | null> {
  const [row] = await db.select().from(userAvatar).where(eq(userAvatar.userId, userId)).limit(1);
  return row ?? null;
}

export async function deleteAvatar(userId: string): Promise<void> {
  await db.delete(userAvatar).where(eq(userAvatar.userId, userId));
}
