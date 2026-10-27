import { AppNavigation } from "@/components/app-navigation";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <AppNavigation />
      <main className="app-content">{children}</main>
    </div>
  );
}
