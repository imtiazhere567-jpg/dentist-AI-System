import { getSettings } from "@/lib/settings";
import { ensureDb } from "@/lib/db";
import { loadTokens, isGoogleConnected, redirectUri, googleCreds } from "@/lib/google";
import { Card, PageTitle } from "@/components/dashboard/ui";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { DataTools } from "@/components/dashboard/DataTools";
import { GoogleConnect } from "@/components/dashboard/GoogleConnect";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  await ensureDb();
  const { google } = await searchParams;
  const [settings, tokens, googleConnected] = await Promise.all([getSettings(), loadTokens(), isGoogleConnected()]);
  const creds = googleCreds();
  // never ship the raw secret to the browser
  const safeSettings = { ...settings, google_client_secret: settings.google_client_secret ? "••••••••" : null };

  return (
    <div>
      <PageTitle title="Settings" sub="Clinic facts the AI uses when writing replies, automation rules, and integrations." />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <SettingsForm initial={safeSettings} />

        <div className="space-y-6 xl:sticky xl:top-8 xl:self-start">
          <GoogleConnect
            clientId={creds.fromEnv ? "" : (settings.google_client_id ?? "")}
            hasSecret={Boolean(settings.google_client_secret)}
            fromEnv={creds.fromEnv}
            connected={googleConnected}
            email={tokens?.email ?? null}
            lastSync={tokens?.last_gmail_sync ?? null}
            redirectUri={redirectUri()}
            clinicName={settings.clinic_name}
            status={google}
          />

          <DataTools />

          <Card title="How the flow works">
            <ol className="space-y-3">
              {[
                ["Lead arrives", "Website form or a new inbox email creates a lead."],
                ["AI triages", "Service, intent, urgency, spam check — and a reply draft from the clinic facts."],
                ["Website visitors get a button", `They can book instantly. AI waits ${settings.followup_minutes} min for that before doing anything.`],
                ["Instant reply or draft", "Emergencies (and simple questions if enabled) are emailed automatically with the booking link. Everything else waits for your Approve & send."],
                ["Booked", "Patient picks a slot on their link, confirms a time by email (AI books it), or staff books from the lead → Calendar event + confirmation email."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-purple-soft text-[11px] font-bold text-purple-ink">{i + 1}</span>
                  <span className="text-sm"><span className="font-semibold text-ink">{t}.</span> <span className="text-muted">{d}</span></span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
