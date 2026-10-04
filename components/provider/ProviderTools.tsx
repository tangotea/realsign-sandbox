import Link from "next/link";

const tools = [
  ["/provider/requests", "Booking requests"],
  ["/provider/availability", "Availability"],
  ["/provider/earnings", "Earnings"],
  ["/provider/application", "Profile & services"],
  ["/provider/payout", "Payout setup"],
  ["/provider/guides", "Lesson guides"],
];

export default function ProviderTools() {
  return <nav className="provider-tool-buttons" aria-label="Provider tools">
    {tools.map(([href, label]) => <Link className="btn secondary" href={href} key={href}>
      <span>{label}</span><span aria-hidden="true" className="service-chevron">&#8250;</span>
    </Link>)}
  </nav>;
}
