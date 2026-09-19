/** All public-site copy in one place so the clinic can swap text without touching components. */
export const site = {
  name: "Swish",
  phone: "1-825-540-7183",
  logo: "/img/logo.webp",
  /** Background video in the hero (Vimeo, muted loop). Set to "" to use heroImage instead. */
  heroVideo: "https://player.vimeo.com/video/1064889176?h=03690cdadc&background=1&autoplay=1&loop=1&muted=1&quality=1080p",
  bands: {
    getInTouch: "/img/band-get-in-touch.webp",
    sayAhh: "/img/band-say-ahh.webp",
  },
  nav: [
    { label: "Why Swish", href: "#why" },
    { label: "Location", href: "#location" },
    { label: "Team", href: "#team" },
    { label: "Services", href: "#services" },
  ],
  hero: {
    line1: "Where oral",
    line2: "care meets self-care.",
    sub1: "Meet Swish, a full-service dental clinic.",
    sub2: "Now open in Bridgeland and University District!",
    image: "/img/gallery-4.jpg",
  },
  locations: [
    {
      name: "University District",
      address: "3928 University Ave NW Calgary, AB T3B 6N7",
    },
    {
      name: "Bridgeland",
      address: "#230, 69 7A Street NE Calgary, AB T2E 4E4",
    },
  ],
  gallery: ["/img/gallery-1.jpg", "/img/gallery-2.jpg", "/img/gallery-3.jpg", "/img/gallery-4.jpg"],
  why: [
    {
      icon: "smile",
      title: "No Shame in Our Game",
      text: "Enjoy a shame-free, super seamless appointment, powered by the latest technology.",
    },
    {
      icon: "wand",
      title: "Tailored to Your Tastes",
      text: "Hot towels, noise-cancelling headphones, and locally sourced coffee just for you.",
    },
    {
      icon: "wallet",
      title: "Ballin' On A Budget",
      text: "Premium perks are standard. We bring the best of the best to your experience.",
    },
  ] as { icon: "smile" | "wand" | "wallet"; title: string; text: string }[],
  team: {
    heading: "The key to great care? Our people.",
    text: "At Swish, our clinic team members are as smart and skilled as they are kind. Get to know them.",
  },
  services: [
    {
      title: "The Essentials",
      image: "/img/service-1.jpg",
      text: "A Comprehensive Dental Exam, Cleaning, 3D Wellness Scans, X-Rays, Complimentary Oral Cancer Screening, and Free Whitening. Regular check-ups stop serious issues before they start and maximize your health as a whole.",
    },
    {
      title: "Kids Dentistry",
      image: "/img/service-2.jpg",
      text: "Gentle Kids Dentistry, Routine Checkups, Professional Cleanings, Digital X-Rays, Fun Preventive Care, and Bright Smile Treatments. Regular dental visits help protect your child's smile early, prevent future issues, and support healthy growth and overall well-being.",
    },
    {
      title: "Dental Work",
      image: "/img/service-3.jpg",
      text: "Comprehensive Dental Work, Precision Treatments, Advanced Imaging, Restorative Care, and Smile-Enhancing Solutions. Proactive dental treatment helps prevent complications, restore function, and support long-term oral and overall health.",
    },
    {
      title: "Invisalign",
      image: "/img/service-4.jpg",
      text: "Customized Invisalign Treatment, Clear Aligners, Digital Smile Scans, Precision Planning, and Comfortable Teeth Straightening. Early orthodontic care improves alignment, boosts confidence, and supports long-term oral health and overall wellness.",
    },
  ],
  social: [
    { label: "Facebook", href: "#" },
    { label: "Instagram", href: "#" },
    { label: "LinkedIn", href: "#" },
    { label: "TikTok", href: "#" },
  ],
};

/**
 * Single source of truth shared by the website form, the AI, the dashboard booking
 * form and the demo data — so the site and the system always describe the same business.
 */
export const SERVICE_OPTIONS = ["The Essentials", "Kids Dentistry", "Dental Work", "Invisalign", "Emergency / Pain", "Other"] as const;
export type ServiceOption = (typeof SERVICE_OPTIONS)[number];
// keep the list in sync with the website's services section
site.services.forEach((s) => {
  if (!(SERVICE_OPTIONS as readonly string[]).includes(s.title)) throw new Error(`SERVICE_OPTIONS is missing "${s.title}" — add it so the form, AI and dashboard stay aligned with the site.`);
});

export const clinic = {
  name: site.name,
  phone: site.phone,
  address: site.locations[0].address,
  locations: site.locations,
  hours: "Mon–Fri 8am–6pm, Sat 9am–2pm",
  /** what the AI is allowed to say about each service */
  services: site.services.map((s) => `${s.title}: ${s.text.split(".")[0]}`).join("\n"),
  pricing_notes: "New patient exam + cleaning from $199. Free Invisalign consultation. Financing available.",
  insurance: "Most major dental insurance plans accepted; direct billing available.",
  tone: "Warm, friendly, concise. Never diagnose. Always offer to book.",
};
