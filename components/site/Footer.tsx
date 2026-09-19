import { Facebook, Instagram, Linkedin, Music2 } from "lucide-react";
import { site } from "@/lib/site-content";
import { Tooth } from "./Logo";
import { BookButton } from "./BookButton";
import { NewsletterForm } from "./NewsletterForm";

const icons = [Facebook, Instagram, Linkedin, Music2];

export function Footer() {
  return (
    <footer>
      {/* "Say ahhh" band — original: 80px/700 #56499B on purple blobs, CTA 14px pill */}
      <div
        className="bg-purple py-16 md:py-20"
        style={{ backgroundImage: `url(${site.bands.sayAhh})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}
      >
        <div className="container-site">
          <h2 className="font-serif text-[56px] leading-[1.2] text-purple-ink md:text-[80px]">
            Say ahhh... <Tooth className="inline-block h-[0.75em] w-[0.75em] align-[-0.05em]" />
          </h2>
          <BookButton size="sm" className="mt-8" />
        </div>
      </div>

      {/* columns — original: 16px text, headings 16px/800, all #56499B, on lavender */}
      <div className="bg-purple-soft py-14 md:py-16">
        <div className="container-site grid gap-12 text-[16px] text-purple-ink md:grid-cols-[1.7fr_1fr_1.2fr_1.25fr]">
          <div>
            <p className="text-[20px] font-bold">Stay in the loop</p>
            <p className="mt-3 max-w-[340px] leading-[1.3]">
              The freshest news, events, and
              <br />
              updates, straight to your inbox.
            </p>
            <NewsletterForm />
          </div>
          <div>
            <p className="font-extrabold uppercase">Navigation</p>
            <ul className="mt-3 space-y-2 uppercase">
              {site.nav.map((n) => (
                <li key={n.href}><a href={n.href} className="hover:text-purple">{n.label}</a></li>
              ))}
              <li><a href="#contact" className="hover:text-purple">Contact Us</a></li>
            </ul>
          </div>
          <div>
            <p className="font-extrabold uppercase">Locations</p>
            {site.locations.map((l) => (
              <div key={l.name} className="mt-3">
                <p className="font-semibold uppercase">Swish {l.name}</p>
                <p className="mt-1 leading-[1.6]">{l.address}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="font-extrabold uppercase">Get Social</p>
            <div className="mt-3 flex gap-2.5">
              {site.social.map((s, i) => {
                const Icon = icons[i];
                return (
                  <a key={s.label} href={s.href} aria-label={s.label} className="grid h-[35px] w-[35px] place-items-center rounded-full bg-[#584D9B] text-white transition-transform duration-200 hover:scale-110 hover:brightness-110">
                    <Icon size={16} />
                  </a>
                );
              })}
            </div>
            <p className="mt-6 font-semibold">Contact</p>
            <a href={`tel:${site.phone}`} className="mt-1 block leading-[1.6] hover:text-purple">{site.phone}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
