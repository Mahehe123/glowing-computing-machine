/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0f4c81',
          dark: '#0b3a63',
          light: '#e7f0f8',
        },
      },
    },
  },
  plugins: [],
}
