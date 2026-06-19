import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design-system tokens — mirrors the CSS vars in globals.css
        bg: "#0d1117",
        surface: "#161b22",
        border: "#30363d",
        primary: "#e6edf3",
        muted: "#8b949e",
        accent: "#58a6ff",
        "accent-dim": "#1f6feb",
        success: "#3fb950",
        warning: "#d29922",
        danger: "#f85149",
        critical: "#ff7b72",
      },
    },
  },
  plugins: [],
};
export default config;
