import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-600">{user.email}</span>
          <Link href="/bonuses" className="text-sm font-medium text-zinc-800 underline">Бонусы</Link>
        </div>
        <SignOutButton />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
