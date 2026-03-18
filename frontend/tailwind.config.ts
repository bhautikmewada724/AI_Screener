import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif']
      },
      colors: {
        brand: {
          navy: '#0f172a',
          accent: '#2563eb',
          slate: '#1e293b',
          ash: '#475569',
          surface: '#f8fafc'
        }
      },
      boxShadow: {
        'card-lg': '0 20px 60px rgba(15, 23, 42, 0.08)',
        'card-sm': '0 6px 20px rgba(15, 23, 42, 0.06)'
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem'
      }
    }
  },
  plugins: [forms]
};

export default config;

