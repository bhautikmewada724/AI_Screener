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
          slate: '#1e293b'
        }
      }
    }
  },
  plugins: [forms]
};

export default config;

