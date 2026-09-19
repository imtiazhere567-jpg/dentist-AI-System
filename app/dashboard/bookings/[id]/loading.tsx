/** Instant skeleton for the booking page. */
export default function BookingLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 h-4 w-28 rounded bg-purple-soft/60" />
      <div className="mb-6 flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-purple-soft/60" />
        <div>
          <div className="h-9 w-56 rounded-xl bg-purple-soft/60" />
          <div className="mt-2 h-4 w-72 rounded bg-purple-soft/40" />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <div className="h-[260px] rounded-3xl bg-white" />
          <div className="h-[200px] rounded-3xl bg-white" />
        </div>
        <div className="space-y-6">
          <div className="h-[110px] rounded-3xl bg-white" />
          <div className="h-[220px] rounded-3xl bg-white" />
        </div>
      </div>
    </div>
  );
}
