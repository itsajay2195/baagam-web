/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0d0d10',
        surface: '#15151a',
        surface2: '#1c1c22',
        border: '#2c2c36',
        text: '#f2f2f5',
        text2: '#9494a8',
        text3: '#5a5a6e',
        accent: '#00e5a0',
        danger: '#ff4a6b',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
