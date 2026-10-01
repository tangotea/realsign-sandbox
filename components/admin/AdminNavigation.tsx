"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLockup from "@/components/BrandLockup";

const groups = [
  { name: "Overview", href: "/admin", links: [["Overview", "/admin"], ["Statistics", "/admin/statistics"]] },
  { name: "People", href: "/admin/users", links: [["Accounts", "/admin/users"], ["Provider approvals", "/admin/providers"]] },
  { name: "Bookings", href: "/admin/bookings", links: [["All bookings", "/admin/bookings"], ["Reviews & reports", "/admin/reviews"]] },
  { name: "Money", href: "/admin/payments", links: [["Payments", "/admin/payments"], ["Payouts", "/admin/payouts"], ["Sponsorships", "/admin/sponsorships"]] },
  { name: "Content & Settings", href: "/admin/help", links: [["Help text & SASL videos", "/admin/help"], ["Rates & rules", "/admin/rules"]] },
];
export default function AdminNavigation() {
  const path = usePathname();
  const matches = (href: string) => href === "/admin" ? path === href : path === href || path.startsWith(href + "/");
  const active = groups.find(group => group.links.some(([, href]) => matches(href))) || groups[0];
  return <header className="admin-navigation">
    <div className="admin-brand-row"><BrandLockup /><strong>Admin</strong><Link href="/">Back to app</Link></div>
    <nav className="admin-primary" aria-label="Admin areas">{groups.map(group => <Link key={group.name} href={group.href} className={active === group ? "active" : ""}>{group.name}</Link>)}</nav>
    <nav className="admin-secondary" aria-label={active.name}>{active.links.map(([name, href]) => <Link key={href} href={href} aria-current={matches(href) ? "page" : undefined}>{name}</Link>)}</nav>
  </header>;
}

