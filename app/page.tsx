import Link from "next/link";
import AppNav from "@/components/AppNav";
import BrandLockup from "@/components/BrandLockup";
import HelpButton from "@/components/help/HelpButton";
import ModeSwitch from "@/components/ExperienceMode";

export default async function Home() {
  return (
    <div className="shell">
      <header className="topbar">
        <BrandLockup />
      </header>

      <main className="main">
        <ModeSwitch />
        <section className="hero">
          <h1>Book a service</h1>
          <p>SASL lessons and interpreting.</p>
        </section>

        <div className="row utility-links" style={{marginTop: 14}}>
          <Link href="/dictionary">Dictionary</Link>
          <Link href="/help">Help in SASL</Link>
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
          <Link className="card choice provider-choice" href="/provider">
            <div className="icon">＋</div>
            <div><h2>Offer a Service</h2><p>Apply as a SASL tutor or interpreter.</p></div>
          </Link>
        </section>
      </main>
      <AppNav />
    </div>
  );
}
