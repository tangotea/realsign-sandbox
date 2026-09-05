"use client";

import { usePathname } from "next/navigation";
import AuthAction from "@/components/AuthAction";

export default function GlobalAuthAction() {
  const pathname = usePathname();

  if (
    pathname === "/sign-in" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/admin")
  ) {
    return null;
  }

  return (
    <div className="global-auth-action">
      <AuthAction initialSignedIn={false} />
    </div>
  );
}
