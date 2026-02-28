/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          100: "#0f251c",
          300: "#2f8f65",
          400: "#22c55e",
          500: "#16a34a",
          600: "#15803d",
        },
      },
    },
  },
  plugins: [],
};
