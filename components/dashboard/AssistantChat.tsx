"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, User } from "lucide-react";

type Turn = { role: "user" | "assistant"; content: string };

const STARTERS = ["How many appointments today?", "Any urgent leads?", "What happened with Marcus?", "What's booked tomorrow?", "Give me a summary", "Who's waiting for a reply?"];

export function AssistantChat({ clinicName }: { clinicName: string }) {
  const [turns, setTurns] = useState<Turn[]>([
    { role: "assistant", content: `Hi! 👋 I'm the ${clinicName} front-desk assistant. Ask me about today's appointments, leads waiting for a reply, urgent cases, or clinic details.` },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>(STARTERS);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, busy]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    const history = turns.slice(-10);
    setTurns((t) => [...t, { role: "user", content: msg }]);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, history }) });
      const j = await r.json();
      setTurns((t) => [...t, { role: "assistant", content: j.reply ?? j.error ?? "Something went wrong." }]);
      if (j.suggestions?.length) setSuggestions(j.suggestions);
    } catch {
      setTurns((t) => [...t, { role: "assistant", content: "Sorry, I couldn't reach the server. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-1 flex-col rounded-3xl bg-white shadow-[0_1px_2px_rgba(86,73,155,0.06),0_12px_32px_-16px_rgba(86,73,155,0.18)]">
      {/* messages */}
      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        {turns.map((t, i) => (
          <div key={i} className={`flex gap-3 ${t.role === "user" ? "justify-end" : "justify-start"}`}>
            {t.role === "assistant" && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-purple-ink text-white"><Sparkles size={16} /></span>}
            <div className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${t.role === "user" ? "rounded-tr-sm bg-purple text-white" : "rounded-tl-sm bg-[#F6F3FF] text-ink"}`}>
              {t.content}
            </div>
            {t.role === "user" && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-purple-soft text-purple-ink"><User size={16} /></span>}
          </div>
        ))}
        {busy && (
          <div className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-purple-ink text-white"><Sparkles size={16} /></span>
            <div className="rounded-2xl rounded-tl-sm bg-[#F6F3FF] px-4 py-3 text-sm text-muted">
              <span className="inline-flex gap-1"><i className="h-2 w-2 animate-bounce rounded-full bg-purple [animation-delay:0ms]" /><i className="h-2 w-2 animate-bounce rounded-full bg-purple [animation-delay:150ms]" /><i className="h-2 w-2 animate-bounce rounded-full bg-purple [animation-delay:300ms]" /></span>
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {/* suggestions */}
      <div className="flex flex-wrap gap-2 border-t border-purple/10 px-6 py-3">
        {suggestions.map((s) => (
          <button key={s} onClick={() => send(s)} disabled={busy} className="rounded-full bg-[#F6F3FF] px-3.5 py-1.5 text-xs font-medium text-purple-ink transition hover:bg-purple-soft disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>

      {/* input */}
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-3 border-t border-purple/10 p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about appointments, leads, bookings…"
          className="dash-input flex-1"
          autoFocus
        />
        <button type="submit" disabled={busy || !input.trim()} className="inline-flex items-center gap-2 rounded-full bg-purple px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple/30 transition hover:bg-purple-deep disabled:opacity-50">
          <Send size={15} /> Ask
        </button>
      </form>
    </div>
  );
}
