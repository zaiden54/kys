import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { AppNavigation } from "@/components/app-navigation";

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
    <div className="app-shell">
      <AppNavigation />
      <main className="app-content">{children}</main>
    </div>
  );
}
