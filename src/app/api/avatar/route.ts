import { auth } from "@/lib/auth";
import { getAvatar } from "@/lib/db/avatar-repository";

// Serves the signed-in user's own photo only — avatars are never shown to
// anyone else, so there is no user id in the URL to enumerate. The `v`
// query parameter is a cache-buster set on every upload, which is what makes
// the long private max-age safe.
export async function GET(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const avatar = await getAvatar(session.user.id);
  if (!avatar) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }

  return new Response(Buffer.from(avatar.data, "base64"), {
    headers: {
      "Content-Type": avatar.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
