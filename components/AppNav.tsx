"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useExperienceMode } from "@/components/ExperienceMode";

const NAV_ITEMS = [
  { href: "/", icon: "", iconSrc: "/nav-icons/home.svg", label: "Home", exact: true },
  { href: "/bookings", icon: "", iconSrc: "/nav-icons/booking.svg", label: "Bookings" },
  { href: "/messages", icon: "", iconSrc: "/nav-icons/message.svg", label: "Messages" },
  { href: "/profile", icon: "", iconSrc: "/nav-icons/profile.svg", label: "Profile", authRequired: true },
];

export default function AppNav() {
  const mode = useExperienceMode();
  const pathname = usePathname();

  return (
    <nav className="bottomnav" aria-label="Primary navigation">
      {NAV_ITEMS.map(item => mode === "provide" && item.href === "/" ? { ...item, href: "/provider", label: "Overview" } : mode === "provide" && item.href === "/bookings" ? { ...item, href: "/provider/bookings" } : item).map(item => {
        const active = item.label === "Bookings"
          ? pathname === item.href || pathname.startsWith("/bookings/") || pathname.startsWith("/provider/bookings") || (mode === "provide" && pathname === "/provider/requests")
          : item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
