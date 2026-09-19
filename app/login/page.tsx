"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/dashboard";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/dashboard/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (res.ok) router.push(next);
    else setErr("Wrong password");
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-[0_24px_60px_-24px_rgba(86,73,155,0.4)]">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-ink font-serif text-2xl italic text-white">S</span>
      <h1 className="mt-5 font-serif text-3xl text-purple-ink">Front desk</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Sign in to the Swish dashboard.</p>
      <label className="mb-1.5 block text-xs font-semibold text-muted">Password</label>
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="dash-input" autoFocus />
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      <button className="mt-5 w-full rounded-full bg-purple py-3 text-sm font-semibold text-white shadow-md shadow-purple/30 hover:bg-purple-deep">Sign in</button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#F6F3FF] p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
