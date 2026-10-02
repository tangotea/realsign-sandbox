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
          <strong>What is RealSign?</strong>
          <HelpButton slug="what-is-realsign" label="What is RealSign help" size="regular" fallbackText="RealSign connects learners with Deaf SASL tutors and South African Sign Language interpreters for lessons and video calls." />
        </div>

        <section className="stack" aria-label="Choose a service">
          <Link className="card choice service-choice" href="/learn">
            <img className="service-illustration" src="/service-illustrations/learn.png" width="112" height="112" alt="" />
            <div><h2>Learn SASL</h2></div>
          </Link>
          <Link className="card choice service-choice" href="/interpreter">
            <img className="service-illustration" src="/service-illustrations/interpret.png" width="112" height="112" alt="" />
            <div><h2>Book an interpreter</h2></div>
          </Link>
        </section>
      </main>
      <AppNav />
    </div>
  );
}
