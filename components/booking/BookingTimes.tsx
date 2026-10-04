"use client";
import { useEffect, useState } from "react";
import { formatBookingTime, validTimeZone } from "@/lib/bookingTime";
import { syncBookingTimezone } from "@/lib/syncBookingTimezone";

export default function BookingTimes({ startAt, endAt, providerZone }: { startAt: string; endAt?: string; providerZone?: string }) {
  const [localZone, setLocalZone] = useState<string | null>(null);
  useEffect(() => { const local = Intl.DateTimeFormat().resolvedOptions().timeZone; setLocalZone(local); void syncBookingTimezone(local); }, []);
  const zone = validTimeZone(providerZone);
  const range = (z: string) => `${formatBookingTime(startAt, z)}${endAt ? ` - ${formatBookingTime(endAt, z)}` : ""}`;
  return <span className="booking-times">
    <span><strong>Your time:</strong> {localZone ? `${range(localZone)} (${localZone.replaceAll("_", " ")})` : "Loading local time..."}</span>
    <span><strong>Provider's time:</strong> {range(zone)} ({zone.replaceAll("_", " ")})</span>
  </span>;
}
