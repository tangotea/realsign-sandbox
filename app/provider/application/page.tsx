import Link from "next/link";
import AppNav from "@/components/AppNav";
import ProviderApplication from "@/components/provider/ProviderApplication";

export default function ProviderApplicationPage(){
  return <div className="shell"><header className="topbar"><Link href="/">←</Link><strong>Provider Application for Deaf Tutors and Interpreters</strong><span /></header><main className="main"><ProviderApplication /></main><AppNav/></div>;
}
