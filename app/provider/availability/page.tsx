import Link from "next/link"; import AppNav from "@/components/AppNav"; import AvailabilityEditor from "@/components/provider/AvailabilityEditor";
export default function AvailabilityPage(){return <div className="shell"><header className="topbar"><Link href="/profile">←</Link><strong>Availability</strong><span /></header><main className="main"><AvailabilityEditor/></main><AppNav/></div>}
