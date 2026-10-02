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
        <h1 className="home-accessible-heading">Book a service</h1>

        <section className="stack" aria-label="Choose a service">
          <Link className="card choice service-choice" href="/learn">
            <img className="service-illustration" src="/service-illustrations/learn.png" width="160" height="160" alt="" />
            <div><h2>Learn SASL</h2></div>
            <span className="service-chevron" aria-hidden="true">&#8250;</span>
          </Link>
          <Link className="card choice service-choice" href="/interpreter">
            <img className="service-illustration" src="/service-illustrations/interpret-light.png" width="160" height="160" alt="" />
            <div><h2>Book an interpreter</h2></div>
            <span className="service-chevron" aria-hidden="true">&#8250;</span>
          </Link>
        </section>
        <div className="row utility-links home-utility-links">
          <Link href="/dictionary">Dictionary</Link>
          <div className="home-about-link">
            <strong>What is RealSign?</strong>
            <HelpButton slug="what-is-realsign" label="What is RealSign help" size="regular" fallbackText="RealSign connects learners with Deaf SASL tutors and South African Sign Language interpreters for lessons and video calls." />
          </div>
        </div>
      </main>
      <AppNav />
    </div>
  );
}
