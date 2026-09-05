import Link from "next/link";
import AppNav from "@/components/AppNav";
import BrandLockup from "@/components/BrandLockup";
import HelpButton from "@/components/help/HelpButton";

export default async function Home() {
  return (
    <div className="shell">
      <header className="topbar">
        <BrandLockup />
      </header>

      <main className="main">
        <section className="hero">
          <h1>Find. Book. Pay. Meet.</h1>
          <p>Deaf tutors and South African Sign Language (SASL) interpreters.</p>
        </section>

        <div className="row" style={{marginTop: 14}}>
          <strong>What is RealSign?</strong>
          <HelpButton slug="what-is-realsign" label="What is RealSign help" size="regular" fallbackText="RealSign connects learners with Deaf SASL tutors and South African Sign Language interpreters for lessons and video calls." />
        </div>

        <section className="stack" aria-label="Choose a service">
          <Link className="card choice" href="/learn">
            <div className="icon">🤟</div>
            <div><h2>Learn Sign Language</h2></div>
          </Link>
          <Link className="card choice" href="/interpreter">
            <div className="icon">👐</div>
            <div><h2>Video Call SASL Interpreting</h2></div>
          </Link>
          <Link className="card choice provider-choice" href="/provider/application">
            <div className="icon">＋</div>
            <div><h2>Offer a Service</h2><p>Apply as a SASL tutor or interpreter.</p></div>
          </Link>
        </section>
      </main>
      <AppNav />
    </div>
  );
}
