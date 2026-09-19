import type { Metadata } from "next";
import localFont from "next/font/local";
import { Jost } from "next/font/google";
import "./globals.css";

/* Same fonts as the original site (self-hosted from public/fonts) */
const tobias = localFont({
  src: "../public/fonts/Tobias-Regular.otf",
  variable: "--font-serif",
  display: "swap",
});
const maison = localFont({
  src: [
    { path: "../public/fonts/MaisonNeue-Book.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/MaisonNeue-Book.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/MaisonNeue-Bold.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/MaisonNeue-Bold.ttf", weight: "700", style: "normal" },
    { path: "../public/fonts/MaisonNeue-Bold.ttf", weight: "800", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});
const jost = Jost({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-jost", display: "swap" });

export const metadata: Metadata = {
  title: "Swish Dental — Where oral care meets self-care",
  description: "Meet Swish, a full-service dental clinic. Book your appointment today.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${tobias.variable} ${maison.variable} ${jost.variable}`}>
      <body className="font-sans bg-cream text-ink antialiased">{children}</body>
    </html>
  );
}
