import Link from "next/link";
import AppNav from "@/components/AppNav";
import LessonGuideDetails from "@/components/marketplace/LessonGuideDetails";
import { INTERPRETER_LESSON_GUIDES, TUTOR_LESSON_GUIDES } from "@/lib/lesson-guides";
import { createClient } from "@/lib/supabase/server";
import HelpButton from "@/components/help/HelpButton";

function GuideList({ guides }: { guides: typeof TUTOR_LESSON_GUIDES }) {
  return (
    <div className="lesson-guide-list">
      {guides.map((guide) => (
        <article className="card lesson-guide-card" key={guide.title}>
          <h2>{guide.title}</h2>
          <p>{guide.description}</p>
          <LessonGuideDetails title={guide.title} />
        </article>
      ))}
    </div>
  );
}

export default async function ProviderGuidesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return (
      <main className="main">
        <section className="card">
          <h1>Lesson guides</h1>
          <p>Sign in to view provider lesson guides.</p>
          <Link className="btn" href="/sign-in">Sign in</Link>
        </section>
      </main>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/profile" aria-label="Back to profile">←</Link>
        <strong>Lesson guides</strong>
        <span />
      </header>
      <main className="main">
        <section className="hero">
          <div className="page-heading">
            <div>
              <h1>Lesson guides</h1>
              <p>Browse the built-in topics you can offer to learners. Choose a guide when adding a service.</p>
            </div>
            <HelpButton slug="provider-lesson-guides" label="Lesson guides help" size="regular" fallbackText="Browse the built-in lesson topics and choose one when adding a service. Learners will see the topic you publish." />
          </div>
        </section>
        <section>
          <h2>Tutor lesson guides</h2>
          <GuideList guides={TUTOR_LESSON_GUIDES} />
        </section>
        <section>
          <h2>Interpreting guides</h2>
          <GuideList guides={INTERPRETER_LESSON_GUIDES} />
        </section>
      </main>
      <AppNav />
    </div>
  );
}
