/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#f8f9fa",
        card: "#ffffff",
        primary: "#342fb7",
        "primary-soft": "#4d4bcf",
        text: "#191c1d",
        "text-muted": "#464554",
        border: "#d9dadb",
        success: "#166534",
        warning: "#7d5800",
        error: "#ba1a1a"
      },
      fontFamily: {
        heading: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"]
      },
      boxShadow: {
        card: "0px 4px 20px rgba(8, 20, 32, 0.04)",
        hover: "0px 8px 30px rgba(8, 20, 32, 0.08)"
      }
    }
  },
  plugins: []
};
