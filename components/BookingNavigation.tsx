import Link from "next/link";

export default function BookingNavigation({ current }: { current: "mine" | "clients" }) {
  return <nav className="mode-switch booking-mode-switch" aria-label="Booking views">
    <Link href="/bookings" aria-current={current === "mine" ? "page" : undefined}><strong>Customer bookings</strong><small>Tutoring and interpreting you have booked.</small></Link>
    <Link href="/provider/bookings" aria-current={current === "clients" ? "page" : undefined}><strong>Provider bookings</strong><small>Sessions clients have booked with you.</small></Link>
  </nav>;
}
