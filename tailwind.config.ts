import type { Config } from 'tailwindcss';

/**
 * QAWSI design tokens.
 * Premium futuristic, corporate-friendly: deep navy base, blue/green accents,
 * subtle purple highlights. Mobile-first; all spacing scales from a small base.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070b1a',
          900: '#0b1124',
          800: '#111a33',
          700: '#1a2747',
          600: '#243561',
        },
        brand: {
          blue: '#3b82f6',
          cyan: '#22d3ee',
          green: '#22c55e',
          emerald: '#10b981',
          purple: '#8b5cf6',
        },
        hud: {
          line: 'rgba(34, 211, 238, 0.35)',
          glow: 'rgba(59, 130, 246, 0.45)',
        },
      },
      fontFamily: {
        // System Arabic-friendly stack; swap for a hosted font later.
        display: ['"Cairo"', '"Tajawal"', 'system-ui', 'sans-serif'],
        body: ['"Tajawal"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(59, 130, 246, 0.35)',
        'glow-green': '0 0 24px rgba(34, 197, 94, 0.35)',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.03)' },
        },
        'flip-in': {
          '0%': { transform: 'rotateY(90deg)', opacity: '0' },
          '100%': { transform: 'rotateY(0deg)', opacity: '1' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s ease-in-out infinite',
        'flip-in': 'flip-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
