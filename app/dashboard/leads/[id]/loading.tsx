/** Instant skeleton for the lead page. */
export default function LeadLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 h-4 w-24 rounded bg-purple-soft/60" />
      <div className="mb-6 flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-purple-soft/60" />
        <div>
          <div className="h-9 w-56 rounded-xl bg-purple-soft/60" />
          <div className="mt-2 h-4 w-72 rounded bg-purple-soft/40" />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <div className="h-[84px] rounded-3xl bg-purple-ink/70" />
          <div className="h-[72px] rounded-3xl bg-white" />
          <div className="h-[150px] rounded-3xl bg-white" />
          <div className="h-[320px] rounded-3xl bg-white" />
        </div>
        <div className="space-y-6">
          <div className="h-[420px] rounded-3xl bg-white" />
          <div className="h-[300px] rounded-3xl bg-white" />
        </div>
      </div>
    </div>
  );
}
