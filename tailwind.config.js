/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        player: {
          bg: 'var(--player-bg)',
          surface: 'var(--player-surface)',
          elevated: 'var(--player-surface-elevated)',
          border: 'var(--player-border)',
          text: 'var(--player-text)',
          muted: 'var(--player-text-muted)',
          accent: 'var(--player-accent)',
          'accent-soft': 'var(--player-accent-soft)',
        },
      },
      spacing: {
        playerXs: 'var(--space-2)',
        playerSm: 'var(--space-3)',
        playerMd: 'var(--space-4)',
        playerLg: 'var(--space-6)',
        playerXl: 'var(--space-8)',
      },
      fontFamily: {
        playerSans: 'var(--font-player-sans)',
        playerSerif: 'var(--font-player-serif)',
      },
      borderRadius: {
        player: 'var(--radius-card)',
      },
      boxShadow: {
        player: 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
};
