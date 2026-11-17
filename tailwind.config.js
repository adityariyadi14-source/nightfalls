/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // built dynamically as `btn-${variant}`
  safelist: ['btn-primary', 'btn-ghost', 'btn-danger'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--c-bg) / <alpha-value>)',
        panel: 'rgb(var(--c-panel) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        accent2: 'rgb(var(--c-accent2) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        fg: 'rgb(var(--c-fg) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)'
      },
      fontFamily: {
        display: ['"Anton"', '"Impact"', '"Arial Narrow"', 'sans-serif'],
        body: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace']
      },
      borderRadius: { lg: '2px', xl: '2px', '2xl': '3px', '3xl': '4px' },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--c-accent) / 0.9), 0 0 24px -4px rgb(var(--c-accent) / 0.55)',
        card: '0 16px 40px -12px rgb(0 0 0 / 0.8)'
      }
    }
  },
  plugins: []
};
