/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      padding: {
        safe: 'env(safe-area-inset-bottom)',
      },
      fontFamily: {
        display: ['var(--font-syne)', 'sans-serif'],
        mono: ['var(--font-plex)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};