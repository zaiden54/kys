/**
 * Round avatar: the uploaded profile photo when there is one, otherwise the
 * user's initials.
 */

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "").slice(0, 2);
  return letters.toUpperCase() || "?";
}

export function UserAvatar({
  name,
  image,
  size = 40,
}: {
  name: string;
  image?: string | null;
  size?: number;
}) {
  return (
    <span
      className="user-avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {image ? (
        // Our own same-origin, already-downscaled photo: next/image adds nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" width={size} height={size} className="user-avatar-photo" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
