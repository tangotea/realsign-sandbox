import Link from "next/link";
import AppNav from "@/components/AppNav";
import ProviderApplication from "@/components/provider/ProviderApplication";

export default function ServicesPage() {
  return <div className="shell">
    <header className="topbar"><Link href="/provider">Back</Link><strong>Services &amp; rates</strong><span /></header>
    <main className="main"><ProviderApplication servicesOnly /></main><AppNav />
  </div>;
}
