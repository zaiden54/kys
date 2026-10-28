import { redirect } from "next/navigation";

// Salary and schedule settings moved into the profile page; keeps old
// links and home-screen bookmarks working.
export default function SalarySettingsRedirect() {
  redirect("/profile#pay");
}
