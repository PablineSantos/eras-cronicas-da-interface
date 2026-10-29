/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        poppins: ['Poppins', 'system-ui', 'sans-serif'],
        pixel: ['"Press Start 2P"', 'monospace'],
        terminal: ['VT323', 'monospace'],
      },
      colors: {
        emerald: { neon: '#10B981' },
        indigo: { neon: '#6366F1' },
        win95: '#C0C0C0',
      },
    },
  },
  plugins: [],
};
