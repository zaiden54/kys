"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="sign-out-button"
      aria-label="Выйти"
      title="Выйти"
    >
      <svg aria-hidden="true" className="sign-out-icon" viewBox="0 0 24 24" fill="none">
        <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sign-out-label">Выйти</span>
    </button>
  );
}
