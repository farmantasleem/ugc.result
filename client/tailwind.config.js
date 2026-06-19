/** @type {import('tailwindcss').Config} */

// Theme is driven by CSS custom properties (see src/theme/theme.css).
// This keeps components theme-based: they reference semantic tokens
// (bg, surface, accent, ...) instead of hard-coded colors, so swapping
// the palette only touches one file.
const withOpacity = (variable) => `rgb(var(${variable}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: withOpacity('--color-bg'),
        surface: withOpacity('--color-surface'),
        'surface-raised': withOpacity('--color-surface-raised'),
        border: withOpacity('--color-border'),
        content: withOpacity('--color-content'),
        muted: withOpacity('--color-muted'),
        accent: withOpacity('--color-accent'),
        'accent-soft': withOpacity('--color-accent-soft'),
        'accent-contrast': withOpacity('--color-accent-contrast'),
        highlight: withOpacity('--color-highlight'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--color-accent) / 0.25), 0 8px 30px rgb(var(--color-accent) / 0.15)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '0.3', transform: 'translateY(0)' },
          '50%': { opacity: '1', transform: 'translateY(-2px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'pulse-dot': 'pulse-dot 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
