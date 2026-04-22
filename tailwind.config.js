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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
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
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-havyn': 'linear-gradient(135deg, #3F6B28 0%, #4C8032 50%, #5A994C 100%)',
        'gradient-havyn-subtle': 'linear-gradient(135deg, #F0F7ED 0%, #E8F4E0 100%)',
        'gradient-havyn-dark': 'linear-gradient(135deg, #1A2E16 0%, #345A22 100%)',
        'gradient-subtle': 'linear-gradient(to bottom, rgba(249, 250, 251, 0.8), rgba(243, 244, 246, 0.8))',
        'gradient-subtle-dark': 'linear-gradient(to bottom, rgba(17, 24, 39, 0.8), rgba(31, 41, 55, 0.8))',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glass-sm': '0 4px 16px 0 rgba(31, 38, 135, 0.2)',
        'glass-lg': '0 12px 48px 0 rgba(31, 38, 135, 0.5)',
        'soft': '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06)',
        'soft-lg': '0 4px 16px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.08)',
        'soft-xl': '0 8px 24px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.1)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'in': 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
};