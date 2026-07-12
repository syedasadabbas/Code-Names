import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Codenames tile palette
        agentRed: "#c0392b",
        agentBlue: "#2471a3",
        bystander: "#d4b483",
        assassin: "#1c1c1c",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};

export default config;
