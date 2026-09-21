/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'putih': '#FFFFFF',
        'hitam': '#000000',
        'hijau': '#81C040',
        'biru': '#343694',
        'grey': '#A9A9A9',
      },
      fontFamily: {
        'arial': ['Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}