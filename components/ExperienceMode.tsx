"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Mode = "book" | "provide";
const ModeContext = createContext<Mode>("book");

export function ExperienceMode({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [saved, setSaved] = useState<Mode>("book");
  const routeMode = pathname === "/" || pathname === "/bookings" || pathname.startsWith("/marketplace") || pathname === "/learn" || pathname === "/interpreter"
    ? "book" : pathname === "/provider" || pathname.startsWith("/provider/") ? "provide" : null;
  const mode = routeMode || saved;
  useEffect(() => {
    try {
      if (routeMode) {
        localStorage.setItem("realsign-mode", routeMode);
        setSaved(routeMode);
      } else {
        setSaved(localStorage.getItem("realsign-mode") === "provide" ? "provide" : "book");
      }
    } catch { /* Navigation still works when storage is unavailable. */ }
  }, [routeMode]);
  return <ModeContext.Provider value={mode}>{children}</ModeContext.Provider>;
}

export function useExperienceMode() { return useContext(ModeContext); }

export default function ModeSwitch() {
  const mode = useExperienceMode();
  return <nav className="mode-switch" aria-label="Choose your RealSign workspace">
    <Link href="/" aria-current={mode === "book" ? "page" : undefined}>Book a service</Link>
    <Link href="/provider" aria-current={mode === "provide" ? "page" : undefined}>Provide a service</Link>
  </nav>;
}
