/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // Design tokens used by the ui/ components (shadcn-style names).
      colors: {
        primary: "#16a34a", // green-600, the brand colour
        input: "#d1d5db", // gray-300, form control borders
        background: "#ffffff",
      },
    },
  },
  plugins: [],
}
