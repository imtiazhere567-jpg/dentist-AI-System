import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Mail, User, Stethoscope, Link2, FileText } from "lucide-react";
import { getAppointment, getLeadById, ensureDb } from "@/lib/db";
import { bookingUrl } from "@/lib/leads";
import { Card, Avatar, fmtTime } from "@/components/dashboard/ui";
import { AppointmentActions } from "@/components/dashboard/AppointmentActions";

export const dynamic = "force-dynamic";

const via: Record<string, string> = {
  dashboard: "Booked by staff from the dashboard",
  patient_link: "Patient booked it themselves via their link",
  ai: "✨ Booked automatically by the AI after the patient confirmed the time by email",
  calendar: "Created in Google Calendar",
};

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  await ensureDb();
  const { id } = await params;
  const appt = getAppointment(id);
  if (!appt) notFound();
  const lead = appt.lead_id ? getLeadById(appt.lead_id) : null;
  const start = new Date(appt.starts_at);
  const mins = Math.round((new Date(appt.ends_at).getTime() - start.getTime()) / 60000);
  const day = start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div>
      <Link href="/dashboard/bookings" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-purple hover:underline">
        <ArrowLeft size={16} /> Back to bookings
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar name={appt.patient_name ?? "?"} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[36px] leading-none text-purple-ink">{appt.patient_name ?? appt.title}</h1>
          <p className="mt-2 text-sm text-muted">{appt.service ?? "Appointment"} · {day} · {fmtTime(appt.starts_at)}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <Card title="Appointment">
            <ul className="grid gap-4 text-sm sm:grid-cols-2">
              <Row icon={<CalendarDays size={15} />} label="Date">{day}</Row>
              <Row icon={<Clock size={15} />} label="Time">{fmtTime(appt.starts_at)} – {fmtTime(appt.ends_at)} ({mins} min)</Row>
              <Row icon={<Stethoscope size={15} />} label="Service">{appt.service ?? "—"}</Row>
              <Row icon={<User size={15} />} label="Patient">{appt.patient_name ?? "—"}</Row>
              <Row icon={<Mail size={15} />} label="Email">{appt.patient_email ? <a href={`mailto:${appt.patient_email}`} className="text-purple hover:underline">{appt.patient_email}</a> : "—"}</Row>
              <Row icon={<Link2 size={15} />} label="Booked via">{appt.booked_via ? via[appt.booked_via] : "—"}</Row>
            </ul>
            {appt.notes && (
              <div className="mt-5 rounded-2xl bg-[#F6F3FF] px-4 py-3 text-sm">
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted"><FileText size={12} /> Patient notes</p>
                <p className="text-ink">{appt.notes}</p>
              </div>
            )}
          </Card>

          <Card title="Links">
            <ul className="space-y-3 text-sm">
              {appt.calendar_link && (
                <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F6F3FF] px-4 py-3">
                  <span className="font-medium text-ink">Google Calendar event</span>
                  <a href={appt.calendar_link} target="_blank" className="font-semibold text-purple hover:underline">Open in Calendar →</a>
                </li>
              )}
              {lead && (
                <>
                  <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F6F3FF] px-4 py-3">
                    <span className="font-medium text-ink">Patient&apos;s booking link</span>
                    <a href={bookingUrl(lead)} target="_blank" className="break-all font-mono text-xs text-purple hover:underline">{bookingUrl(lead)}</a>
                  </li>
                  <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F6F3FF] px-4 py-3">
                    <span className="font-medium text-ink">Lead &amp; conversation</span>
                    <Link href={`/dashboard/leads/${lead.id}`} className="font-semibold text-purple hover:underline">Open lead →</Link>
                  </li>
                </>
              )}
            </ul>
          </Card>
        </div>

        <div className="xl:sticky xl:top-8 xl:self-start">
          <AppointmentActions appointment={appt} />
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-purple-soft text-purple-ink">{icon}</span>
      <span>
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
        <span className="block text-ink">{children}</span>
      </span>
    </li>
  );
}
