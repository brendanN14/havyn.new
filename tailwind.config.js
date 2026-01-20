/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
      colors: {
        havyn: {
          primary: '#3F6B28',
          dark: '#345A22',
          hover: '#345A22', // Same as dark for hover states
          light: '#4C8032',
          lighter: '#5A994C',
          lightest: '#68B359',
          // Subtle variant for backgrounds
          subtle: '#F0F7ED',
          'subtle-dark': '#1A2E16'
        },
        // Status colors with consistent naming
        status: {
          success: {
            DEFAULT: '#16A34A', // green-600
            bg: '#DCFCE7', // green-50
            'bg-dark': '#14532D', // green-900 with opacity
            text: '#15803D', // green-800
            'text-dark': '#86EFAC' // green-400
          },
          warning: {
            DEFAULT: '#CA8A04', // yellow-600
            bg: '#FEF9C3', // yellow-50
            'bg-dark': '#713F12', // yellow-900 with opacity
            text: '#854D0E', // yellow-800
            'text-dark': '#FCD34D' // yellow-400
          },
          danger: {
            DEFAULT: '#DC2626', // red-600
            bg: '#FEE2E2', // red-50
            'bg-dark': '#7F1D1D', // red-900 with opacity
            text: '#991B1B', // red-800
            'text-dark': '#F87171' // red-400
          },
          info: {
            DEFAULT: '#2563EB', // blue-600
            bg: '#DBEAFE', // blue-50
            'bg-dark': '#1E3A8A', // blue-900 with opacity
            text: '#1E40AF', // blue-800
            'text-dark': '#60A5FA' // blue-400
          }
        }
      }
    },
  },
  plugins: [],
};