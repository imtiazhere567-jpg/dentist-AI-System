import { Logo } from "@/components/site/Logo";
import { BookingPicker } from "@/components/site/BookingPicker";

export const dynamic = "force-dynamic";

export default async function BookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-cream">
      <header className="container-site flex items-center justify-between py-8">
        <a href="/" aria-label="Swish"><Logo /></a>
        <a href="/" className="text-[16px] font-semibold text-purple hover:text-purple-deep">← Back to site</a>
      </header>
      <section className="container-site pb-24 pt-4">
        <BookingPicker token={token} />
      </section>
    </main>
  );
}
