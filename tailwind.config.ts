import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF6E4",
        "cream-deep": "#FDFAF5",
        purple: {
          DEFAULT: "#816EE7",
          light: "#8B72F1",
          deep: "#5D54A4",
          ink: "#56499B",
          soft: "#E2DBFF",
          softer: "#E0D9FF",
        },
        gold: "#F1B434",
        ink: "#2C2C2C",
        muted: "#626262",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"], // Tobias
        sans: ["var(--font-sans)", "system-ui", "sans-serif"], // Maison Neue
        jost: ["var(--font-jost)", "system-ui", "sans-serif"], // contact form
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
