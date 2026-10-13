/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Same brand colors as the Operations Hub
        brand: {
          50: "#f0f7ee",
          100: "#dcecd7",
          500: "#4a8a3c",
          600: "#3c7230",
          700: "#305c27",
        },
      },
    },
  },
  plugins: [],
};
