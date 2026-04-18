/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 12px 32px rgba(56, 189, 248, 0.2)",
      },
      minHeight: {
        "screen-dvh": "100dvh",
      },
      padding: {
        "safe-t": "env(safe-area-inset-top, 0px)",
        "safe-b": "env(safe-area-inset-bottom, 0px)",
      },
    },
  },
  plugins: [],
}

