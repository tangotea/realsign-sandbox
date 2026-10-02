import Link from "next/link";

export default function BookingNavigation({ current }: { current: "mine" | "clients" }) {
  return <nav className="booking-navigation" aria-label="Booking views">
    <Link href="/bookings" aria-current={current === "mine" ? "page" : undefined}>My bookings</Link>
    <Link href="/provider/bookings" aria-current={current === "clients" ? "page" : undefined}>Client bookings</Link>
  </nav>;
}
