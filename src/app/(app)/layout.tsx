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
      <header
        className="border-b border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-14 items-center justify-between px-6">
          <Link
            href="/"
            className="text-[length:var(--font-size-heading)] font-[number:var(--font-weight-heading)] text-[color:var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
          >
            НаРуки
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main
        className="flex flex-1 flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {children}
      </main>
    </div>
  );
}
