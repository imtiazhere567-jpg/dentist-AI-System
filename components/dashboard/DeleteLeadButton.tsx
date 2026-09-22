"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

/** Small delete control for a row in the leads list. */
export function DeleteLeadButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove(e: React.MouseEvent) {
    e.preventDefault(); // the row is a link
    e.stopPropagation();
    if (!confirm(`Delete ${name} and the whole conversation? This can't be undone.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error ?? "Delete failed");
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      aria-label={`Delete ${name}`}
      title="Delete lead"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 disabled:opacity-50 group-hover:opacity-100"
    >
      <Trash2 size={15} />
    </button>
  );
}
