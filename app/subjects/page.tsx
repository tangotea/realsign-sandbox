import Link from "next/link";
import AppNav from "@/components/AppNav";
import { PHASES } from "@/lib/marketplace";

export default function SubjectsPage() {
  return <div className="shell">
    <header className="topbar"><Link href="/">←</Link><strong>School Help</strong><button className="help-btn" aria-label="Open SASL help">?</button></header>
    <main className="main">
      <section className="hero"><h1>Who needs help?</h1><p>Choose a school phase. You will only see relevant subjects next.</p></section>
      <div className="grid2">{PHASES.map((p)=><Link href={`/subjects/${p.slug}`} key={p.slug} className="card phase-card"><strong>{p.label}</strong><span>Choose subjects →</span></Link>)}</div>
    </main><AppNav />
  </div>;
}
