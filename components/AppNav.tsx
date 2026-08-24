"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/", icon: "⌂", label: "Home", exact: true },
  { href: "/bookings", icon: "▣", label: "Bookings" },
  { href: "/dictionary", icon: "⌕", label: "Dictionary" },
  { href: "/messages", icon: "▤", label: "Messages" },
  { href: "/profile", icon: "◉", label: "Profile", authRequired: true },
];

export default function AppNav() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setSignedIn(Boolean(data.user));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <nav className="bottomnav" aria-label="Primary navigation">
      {NAV_ITEMS.filter(item => !item.authRequired || signedIn).map(item => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
            <span>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
