import Link from "next/link";
import AppNav from "@/components/AppNav";
import ProviderApplication from "@/components/provider/ProviderApplication";

export default function ProviderApplicationPage(){
  return <div className="shell"><header className="topbar"><Link href="/provider">←</Link><strong>Provider Application</strong><button className="help-btn" aria-label="Open SASL help">?</button></header><main className="main"><ProviderApplication /></main><AppNav/></div>;
}
