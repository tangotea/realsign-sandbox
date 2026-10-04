import { bookingRole } from "@/lib/bookingRole";

export default function BookingRole({ serviceRole, providing = false }: { serviceRole?: string; providing?: boolean }) {
  const role = bookingRole(serviceRole, providing);
  return <div className="booking-role"><strong>Your role: I am the {role}</strong>{role === "Client" ? <p>I booked an interpreter.</p> : null}</div>;
}
