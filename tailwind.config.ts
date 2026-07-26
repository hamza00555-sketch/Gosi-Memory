import type { Config } from 'tailwindcss';

/**
 * Party-game palette.
 *
 * The camera is the backdrop on the main screen, so surfaces are warm ink
 * rather than the old cyber navy, and every chip that sits over live video
 * carries enough contrast to stay legible against a bright table.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0B0A10',
          900: '#141220',
          800: '#1E1B2E',
          700: '#2A2540',
          600: '#3A3355',
          500: '#4E4670',
        },
        cream: '#FFF6EC',
        team: {
          coral: '#FF5F57',
          'coral-soft': '#FF9A94',
          violet: '#8B5CF6',
          'violet-soft': '#BFA3FF',
          lime: '#57E08A',
          'lime-soft': '#9BF0BB',
          amber: '#FFB020',
          'amber-soft': '#FFD27A',
        },
        pop: {
          yellow: '#FFD84D',
          pink: '#FF5FA2',
          mint: '#3DE0C0',
          sky: '#54B8FF',
        },
        good: '#28D6A0',
        bad: '#FF4D6D',
      },
      fontFamily: {
        display: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
        body: ['Tajawal', 'Cairo', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        chunk: '1.5rem',
        pill: '999px',
      },
      boxShadow: {
        chunk: '0 6px 0 0 rgba(0,0,0,0.35)',
        'chunk-sm': '0 4px 0 0 rgba(0,0,0,0.3)',
        lift: '0 12px 40px -8px rgba(0,0,0,0.6)',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.7)', opacity: '0' },
          '60%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        squash: {
          '0%,100%': { transform: 'scale(1,1)' },
          '40%': { transform: 'scale(1.12,0.88)' },
          '70%': { transform: 'scale(0.95,1.05)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 currentColor', opacity: '0.9' },
          '100%': { boxShadow: '0 0 0 18px transparent', opacity: '0' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-5px)' },
          '80%': { transform: 'translateX(5px)' },
        },
        'scan-sweep': {
          '0%': { transform: 'translateY(-110%)' },
          '100%': { transform: 'translateY(110%)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 320ms cubic-bezier(0.34,1.56,0.64,1) both',
        squash: 'squash 420ms cubic-bezier(0.34,1.56,0.64,1)',
        'slide-up': 'slide-up 280ms cubic-bezier(0.22,1,0.36,1) both',
        'pulse-ring': 'pulse-ring 1.4s ease-out infinite',
        shake: 'shake 420ms ease-in-out',
        'scan-sweep': 'scan-sweep 2.4s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
