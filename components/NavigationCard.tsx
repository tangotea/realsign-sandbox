import Link from "next/link";
import HelpButton from "@/components/help/HelpButton";

type Props = {
  href: string;
  icon: string;
  title: string;
  description: string;
  status?: string;
  helpSlug?: string;
  helpText?: string;
};

export default function NavigationCard({ href, icon, title, description, status, helpSlug, helpText }: Props) {
  return <div className="card navigation-card">
    {icon ? <span className="navigation-card-icon" aria-hidden="true">{icon}</span> : null}
    <div className="navigation-card-content">
      <div className="navigation-card-heading">
        <h2><Link href={href}>{title}</Link></h2>
        {status ? <span className="status">{status}</span> : null}
        {helpSlug ? <HelpButton slug={helpSlug} label={`${title} help`} fallbackText={helpText} /> : null}
      </div>
      <p>{description}</p>
    </div>
    <span className="service-chevron" aria-hidden="true">&#8250;</span>
  </div>;
}
