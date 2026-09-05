import Link from "next/link";
import AppNav from "@/components/AppNav";
import ProviderApplication from "@/components/provider/ProviderApplication";
import HelpButton from "@/components/help/HelpButton";

export default function ProviderApplicationPage(){
  return <div className="shell"><header className="topbar"><Link href="/">←</Link><strong>Provider Application for Deaf Tutors and Interpreters</strong><HelpButton slug="provider-application" label="Provider application help" size="regular" fallbackText="Complete this application to offer SASL tutoring, SASL interpreting, or both. Provider approval is required before learners can book you." /></header><main className="main"><ProviderApplication /></main><AppNav/></div>;
}
