/** Public base URL of the app (booking links, OAuth redirect). Falls back to the Vercel URL, then localhost. */
export function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const v = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (v) return `https://${v}`;
  return "http://localhost:3000";
}
