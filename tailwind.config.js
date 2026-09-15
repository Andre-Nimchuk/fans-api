/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: '#202127',
        muted: '#777785',
        line: '#E9E9EF',
        brand: '#605BE8',
        incoming: '#F3F3F5',
        outgoing: '#F6F5FE',
        selected: '#EEECFF',
      },
    },
  },
  plugins: [],
};
