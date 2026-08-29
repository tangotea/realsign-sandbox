import { lessonGuideForTitle } from "@/lib/lesson-guides";

export default function LessonGuideDetails({ title }: { title?: string | null }) {
  const guide = lessonGuideForTitle(title);
  if (!guide) return null;

  return (
    <details className="lesson-guide">
      <summary>View lesson guide</summary>
      <div className="lesson-guide-content">
        <p>{guide.description}</p>
        <strong>What you may practise</strong>
        <ul>{guide.topics.map(topic => <li key={topic}>{topic}</li>)}</ul>
        <small>{guide.suitableFor}</small>
      </div>
    </details>
  );
}
