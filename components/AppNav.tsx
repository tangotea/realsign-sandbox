"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/", icon: "", iconSrc: "/nav-icons/home.svg", label: "Home", exact: true },
  { href: "/bookings", icon: "", iconSrc: "/nav-icons/booking.svg", label: "Bookings" },
  { href: "/dictionary", icon: "⌕", iconSrc: "", label: "Dictionary" },
  { href: "/messages", icon: "", iconSrc: "/nav-icons/message.svg", label: "Messages" },
  { href: "/profile", icon: "", iconSrc: "/nav-icons/profile.svg", label: "Profile", authRequired: true },
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
            <span className="nav-icon-frame" aria-hidden="true">{item.iconSrc ? <img className="nav-icon-img" src={item.iconSrc} alt="" /> : item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
