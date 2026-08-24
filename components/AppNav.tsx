"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", icon: "⌂", label: "Home", exact: true },
  { href: "/bookings", icon: "▣", label: "Bookings" },
  { href: "/dictionary", icon: "⌕", label: "Dictionary" },
  { href: "/messages", icon: "▤", label: "Messages" },
  { href: "/profile", icon: "◉", label: "Profile" },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="bottomnav" aria-label="Primary navigation">
      {NAV_ITEMS.map(item => {
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
