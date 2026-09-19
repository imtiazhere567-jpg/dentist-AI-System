import { PageTitle } from "@/components/dashboard/ui";
import { ensureDb } from "@/lib/db";
import { AssistantChat } from "@/components/dashboard/AssistantChat";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  await ensureDb();
  const settings = await getSettings();
  return (
    <div className="flex h-full flex-col">
      <PageTitle title="AI Assistant" sub="Ask about appointments, leads, bookings and clinic details." />
      <AssistantChat clinicName={settings.clinic_name} />
    </div>
  );
}
