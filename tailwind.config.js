/** @type {import('tailwindcss').Config} */

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,vue}'],
  theme: {
    container: { center: true },
    extend: {
      colors: {
        fluent: {
          primary: 'var(--fluent-primary)',
          'primary-hover': 'var(--fluent-primary-hover)',
          'primary-pressed': 'var(--fluent-primary-pressed)',
          'primary-tint': 'var(--fluent-primary-tint)',
        },
        surface: {
          base: 'var(--bg-base)',
          mica: 'var(--bg-mica)',
          card: 'var(--bg-card)',
          'card-2': 'var(--bg-card-2)',
          hover: 'var(--bg-hover)',
          pressed: 'var(--bg-pressed)',
        },
        ink: {
          1: 'var(--text-1)',
          2: 'var(--text-2)',
          3: 'var(--text-3)',
          4: 'var(--text-4)',
        },
        stroke: 'var(--stroke)',
        'stroke-strong': 'var(--stroke-strong)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
      },
      borderRadius: {
        fluent: 'var(--radius-md)',
        'fluent-lg': 'var(--radius-lg)',
        'fluent-xl': 'var(--radius-xl)',
      },
      boxShadow: {
        f2: 'var(--shadow-2)',
        f4: 'var(--shadow-4)',
        f8: 'var(--shadow-8)',
        f16: 'var(--shadow-16)',
        f64: 'var(--shadow-64)',
      },
      fontFamily: {
        sans: [
          'Segoe UI',
          'Segoe UI Variable',
          'Microsoft YaHei UI',
          'Microsoft YaHei',
          'system-ui',
          'sans-serif',
        ],
      },
      transitionTimingFunction: {
        fluent: 'cubic-bezier(0.1, 0.9, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
