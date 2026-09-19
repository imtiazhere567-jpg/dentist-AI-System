/** Instant skeleton while a dashboard page streams in — makes tab switches feel immediate. */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8">
        <div className="h-10 w-56 rounded-xl bg-purple-soft/60" />
        <div className="mt-3 h-4 w-72 rounded-lg bg-purple-soft/40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[118px] rounded-3xl bg-white" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <div className="h-[260px] rounded-3xl bg-white" />
          <div className="h-[380px] rounded-3xl bg-white" />
        </div>
        <div className="space-y-6">
          <div className="h-[220px] rounded-3xl bg-white" />
          <div className="h-[180px] rounded-3xl bg-white" />
        </div>
      </div>
    </div>
  );
}
