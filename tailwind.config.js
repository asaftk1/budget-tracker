/** @type {import('tailwindcss').Config} */

// Colour tokens are CSS variables holding space-separated RGB channels (see src/index.css), so
// utilities such as bg-primary/10 work and a dark theme can later override the variables only.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Heebo is loaded from Google Fonts in public/index.html; the rest is the fallback chain.
        sans: ["Heebo", "system-ui", "-apple-system", "'Segoe UI'", "Arial", "sans-serif"],
      },
      colors: {
        // Names the ui/ components and tests already rely on (shadcn-style).
        primary: {
          DEFAULT: token("primary"), // brand green, AA on white for text
          hover: token("primary-hover"),
          soft: token("primary-soft"), // light tint for selected or subtle fills
          foreground: token("primary-foreground"),
        },
        input: token("input"), // form control borders (3:1 against the page)
        background: token("background"), // white: field and surface backgrounds

        canvas: token("canvas"), // the page behind the cards
        card: token("card"),
        "card-foreground": token("card-foreground"),
        foreground: token("foreground"),
        border: token("border"), // hairlines: border-border, bg-border (dividers)
        muted: {
          DEFAULT: token("muted"),
          foreground: token("muted-foreground"),
        },
        // Meaning of money and danger. Income and expense differ in hue and lightness, so they
        // stay apart for viewers with red-green colour blindness.
        income: token("income"),
        expense: token("expense"),
        danger: {
          DEFAULT: token("danger"),
          foreground: token("primary-foreground"),
        },
        ring: token("ring"),

        // Existing markup and tests use text-green-600 / bg-green-600 as the brand green. Point
        // that shade at the primary token so it gets the accessible value everywhere at once.
        green: { 600: token("primary") },
        // Temporary: the pages still set bg-gray-50 as their own background. Pointing it at the
        // canvas keeps them the same colour as the layout until each page drops its wrapper.
        gray: { 50: token("canvas") },
      },
      borderColor: {
        DEFAULT: token("border"), // the colour of a plain `border` class
      },
      borderRadius: {
        control: "var(--radius-control)", // inputs and buttons
        card: "var(--radius-card)",
        dialog: "var(--radius-dialog)",
      },
      boxShadow: {
        card: "0 1px 2px rgb(20 32 26 / 0.05), 0 1px 3px rgb(20 32 26 / 0.06)",
      },
    },
  },
  plugins: [],
}
