import NavigationCard from "@/components/NavigationCard";

const tools = [
  { href: "/provider/requests", icon: "", title: "Booking requests", description: "Review and respond to client requests." },
  { href: "/provider/availability", icon: "", title: "Availability", description: "Your regular hours and closed dates." },
  { href: "/provider/earnings", icon: "", title: "Earnings & payouts", description: "Your earnings, payouts and bank account." },
  { href: "/provider/application", icon: "", title: "Provider profile", description: "Your application, verification and introduction." },
  { href: "/provider/services", icon: "", title: "Services & rates", description: "Your lessons, interpreting, prices and booking preferences." },
  { href: "/provider/guides", icon: "", title: "Lesson guides", description: "Teaching outlines and lesson material." },
];

export default function ProviderTools() {
  return <nav className="provider-tool-cards stack" aria-label="Provider tools">
    {tools.map(tool => <NavigationCard key={tool.href} {...tool} />)}
  </nav>;
}
