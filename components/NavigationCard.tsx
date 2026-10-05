import Link from "next/link";
import HelpButton from "@/components/help/HelpButton";

type Props = {
  href: string;
  icon?: string;
  iconSrc?: string;
  title: string;
  description: string;
  status?: string;
  helpSlug?: string;
  helpText?: string;
};

export default function NavigationCard({ href, icon, iconSrc, title, description, status, helpSlug, helpText }: Props) {
  return <div className="card navigation-card">
    {iconSrc || icon ? <span className="navigation-card-icon" aria-hidden="true">{iconSrc ? <img className="settings-icon" src={iconSrc} width="30" height="30" alt="" /> : icon}</span> : null}
    <div className="navigation-card-content">
      <div className="navigation-card-heading">
        <h2><Link href={href}>{title}</Link></h2>
        {status ? <span className="status">{status}</span> : null}
        {helpSlug ? <HelpButton slug={helpSlug} label={`${title} help`} fallbackText={helpText} /> : null}
      </div>
      <p>{description}</p>
    </div>
    <img className="settings-chevron" src="/ui-icons/chevron-right.svg" width="24" height="24" alt="" aria-hidden="true" />
  </div>;
}
