import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { Locations } from "@/components/site/Locations";
import { Why, Team, Services } from "@/components/site/Sections";
import { ContactSection } from "@/components/site/ContactForm";
import { Footer } from "@/components/site/Footer";

export default function Home() {
  return (
    <main className="relative bg-cream">
      <Nav />
      <Hero />
      <Locations />
      <Why />
      <Team />
      <Services />
      <ContactSection />
      <Footer />
    </main>
  );
}
