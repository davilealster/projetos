import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pds: {
          black: "#000000",
          ink: "#0b0b0c",
          card: "#141416",
          line: "#26262b",
          orange: "#F58220",
          orangeDark: "#C9640F",
          orangeSoft: "#FFB067",
          muted: "#9b9ba3",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(245,130,32,0.35), 0 10px 30px -12px rgba(245,130,32,0.45)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up .25s ease-out both",
        "slide-in": "slide-in .22s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
