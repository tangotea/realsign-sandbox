import NavigationCard from "@/components/NavigationCard";

const tools = [
  { href: "/provider/requests", iconSrc: "/ui-icons/calendar-check.svg", title: "Booking requests", description: "Review and respond to client requests." },
  { href: "/provider/availability", iconSrc: "/ui-icons/calendar-clock.svg", title: "Availability", description: "Your regular hours and closed dates." },
  { href: "/provider/earnings", iconSrc: "/ui-icons/wallet.svg", title: "Earnings & payouts", description: "Your earnings, payouts and bank account." },
  { href: "/provider/application", iconSrc: "/ui-icons/user-round.svg", title: "Provider profile", description: "Your application, verification and introduction." },
  { href: "/provider/services", iconSrc: "/ui-icons/tags.svg", title: "Services & rates", description: "Your lessons, interpreting, prices and booking preferences." },
  { href: "/provider/guides", iconSrc: "/ui-icons/book-open.svg", title: "Lesson guides", description: "Teaching outlines and lesson material." },
];

export default function ProviderTools() {
  return <nav className="provider-tool-cards stack" aria-label="Provider tools">
    {tools.map(tool => <NavigationCard key={tool.href} {...tool} />)}
  </nav>;
}
