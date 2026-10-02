import Link from "next/link";
import AppNav from "@/components/AppNav";
import BrandLockup from "@/components/BrandLockup";
import BookingNavigation from "@/components/BookingNavigation";
import { createClient } from "@/lib/supabase/server";
import { serviceLabel } from "@/lib/marketplace";

export default async function ProviderBookings() {
  const s = await createClient();
  const { data: auth } = await s.auth.getUser();
  if (!auth.user) return <main className="main"><h1>Provider bookings</h1><Link className="btn" href="/sign-in?next=%2Fprovider%2Fbookings">Sign in / Sign up</Link></main>;
  const { data: provider } = await s.from("provider_profiles").select("id").eq("user_id", auth.user.id).maybeSingle();
  const { data: bookings, error } = provider
    ? await s.from("bookings").select("id,state,start_at,learner_first_name,provider_services(title,provider_role)").eq("provider_id", provider.id).order("start_at", { ascending: false })
    : { data: null, error: null };
  return <div className="shell"><header className="topbar"><BrandLockup /></header><main className="main">
    <div className="page-heading"><h1>Client bookings</h1><Link className="btn secondary" href="/provider/requests">Requests</Link></div>
    {provider ? <BookingNavigation current="clients" /> : <Link className="profile-provider-link" href="/bookings">My bookings</Link>}
    {error ? <p role="alert">Bookings could not load. Please try again.</p> : null}
    {!provider ? <Link className="btn" href="/provider/application">Start provider application</Link> : null}
    <div className="stack">{(bookings || []).map((booking: any) => <article className="card" key={booking.id}>
      <span className="status">{booking.state.replaceAll("_", " ")}</span>
      <h2>{booking.learner_first_name || "Verified learner"}</h2>
      <p>{new Date(booking.start_at).toLocaleString()} · {serviceLabel(booking.provider_services)}</p>
      <Link className="btn secondary" href={`/bookings/${booking.id}`}>View booking</Link>
    </article>)}</div>
    {provider && !error && !bookings?.length ? <p>No provider bookings yet.</p> : null}
  </main><AppNav /></div>;
}
