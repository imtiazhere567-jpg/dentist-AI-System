"use client";

import { useState } from "react";
import { site, SERVICE_OPTIONS } from "@/lib/site-content";
import { Select } from "./Select";

type State = "idle" | "sending" | "sent" | "error";

export function ContactSection() {
  return (
    <section id="contact">
      {/* original: band with lavender/gold blobs, heading 48px/800 #56499B */}
      <div
        className="flex min-h-[160px] items-center justify-center bg-purple-soft md:min-h-[212px]"
        style={{ backgroundImage: `url(${site.bands.getInTouch})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}
      >
        <h2 className="text-center text-[36px] font-extrabold tracking-wide text-purple-ink md:text-[48px]">GET IN TOUCH</h2>
      </div>
      <div className="container-site pb-24 pt-16 md:pt-24">
        <ContactForm />
      </div>
    </section>
  );
}

export function ContactForm() {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ bookingUrl?: string; urgent?: boolean; autoReplied?: boolean }>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Something went wrong");
      setResult(json);
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }

  /* original form uses Jost */
  const card = "mx-auto max-w-[800px] rounded-[14px] border-t-[6px] border-purple bg-white font-jost shadow-[0_30px_80px_-30px_rgba(129,110,231,0.45)]";

  if (state === "sent") {
    return (
      <div className={`${card} px-8 py-16 text-center`}>
        <h3 className="text-[28px] font-semibold text-ink">✔ Message Sent!</h3>
        {result.urgent ? (
          <p className="mt-3 text-[18px] text-muted">That sounds urgent — grab the earliest opening right now, or we&apos;ll email you the options in a few minutes.</p>
        ) : (
          <p className="mt-3 text-[18px] text-muted">Thanks — our team will get back to you shortly. Want to skip the wait?</p>
        )}
        {result.bookingUrl && (
          <a
            href={result.bookingUrl}
            className="mt-7 inline-flex rounded-[10px] border-2 border-purple-light bg-purple-light px-10 py-4 text-[20px] font-semibold text-white transition-all duration-[400ms] hover:bg-white hover:text-purple-light"
          >
            {result.urgent ? "See earliest openings" : "Pick a time now"}
          </a>
        )}
      </div>
    );
  }

  /* original: card 800 wide, padding 50px, title 36px/600, labels 19px/500, inputs 18px h62, button 22px/600 h76 */
  return (
    <form onSubmit={onSubmit} className={`${card} px-6 py-10 sm:px-12 sm:py-12`}>
      <h3 className="mb-10 text-center text-[30px] font-semibold tracking-[-0.5px] text-[#2C2C2C] md:text-[36px]">Contact Us</h3>
      {/* honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="first_name">First Name</label>
          <input id="first_name" name="first_name" required className="input" placeholder="Enter first name" />
        </div>
        <div>
          <label className="label" htmlFor="last_name">Last Name</label>
          <input id="last_name" name="last_name" className="input" placeholder="Enter last name" />
        </div>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="email">Email Address</label>
          <input id="email" name="email" type="email" required className="input" placeholder="email@example.com" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone (optional)</label>
          <input id="phone" name="phone" type="tel" className="input" placeholder="(207) 555-0100" />
        </div>
      </div>
      <div className="mt-6">
        <label className="label">I&apos;m interested in</label>
        <Select
          name="service"
          label="I'm interested in"
          placeholder="Select a service"
          required
          options={[...SERVICE_OPTIONS]}
        />
      </div>
      <div className="mt-6">
        <label className="label" htmlFor="message">Message</label>
        <textarea id="message" name="message" required rows={6} className="input resize-none" placeholder="How can we help?" />
      </div>
      {error && <p className="mt-3 text-[15px] text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        /* original: inverts to white bg + purple text/border over .4s */
        className="mt-9 w-full rounded-[10px] border-2 border-purple-light bg-purple-light py-5 text-[20px] font-semibold text-white transition-all duration-[400ms] hover:bg-white hover:text-purple-light disabled:opacity-60 md:text-[22px]"
      >
        {state === "sending" ? "Sending… checking availability" : "Send Message"}
      </button>
    </form>
  );
}
