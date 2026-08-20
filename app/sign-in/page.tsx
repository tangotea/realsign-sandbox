import Link from "next/link";
import AuthPanel from "@/components/AuthPanel";

export default function SignIn(){
  return <div className="shell"><header className="topbar"><Link href="/">←</Link><strong>RealSign Account</strong><span/></header><main className="main"><AuthPanel /></main></div>
}
