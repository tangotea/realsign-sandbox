import Link from "next/link";

export default function AppNav() {
  return (
    <nav className="bottomnav" aria-label="Primary navigation">
      <Link href="/"><span>⌂</span>Home</Link>
      <Link href="/bookings"><span>▣</span>Bookings</Link>
      <Link href="/dictionary"><span>⌕</span>Dictionary</Link>
      <Link href="/messages"><span>▤</span>Messages</Link>
      <Link href="/profile"><span>◉</span>Profile</Link>
    </nav>
  );
}
