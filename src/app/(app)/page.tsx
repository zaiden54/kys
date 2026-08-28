import { getSessionUser } from "@/lib/session";

// HOME-01 stays minimal (amount + date only, once Plan 01-05 wires the
// forecast card). This shell's only job is to prove the authenticated
// read path works end-to-end. Per D-15, no salary-change notice belongs here.
export default async function HomePage() {
  const user = await getSessionUser();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Добро пожаловать</h1>
      <p className="text-zinc-600">Вы вошли как {user?.email}</p>
    </div>
  );
}
