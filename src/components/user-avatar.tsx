/**
 * Round avatar with the user's initials. A photo upload replaces the
 * initials once profiles land; until then this is the only avatar source.
 */

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "").slice(0, 2);
  return letters.toUpperCase() || "?";
}

export function UserAvatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="user-avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
