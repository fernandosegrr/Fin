import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        fintech: {
          bg: "#090d16",
          card: "#111726",
          border: "rgba(255, 255, 255, 0.08)",
          accent: "#10b981",
          income: "#10b981",
          expense: "#f43f5e",
        },
      },
      maxWidth: {
        app: "640px",
        desktop: "1100px",
      },
      keyframes: {
        shiny: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
      },
      animation: {
        shiny: "shiny 6s linear infinite",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-top": "env(safe-area-inset-top)",
      },
    },
  },
  plugins: [],
};

export default config;
