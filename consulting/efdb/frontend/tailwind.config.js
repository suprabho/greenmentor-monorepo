/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Greenmentor brand — sourced from green-mentor-plus design tokens
        teal: {
          900: '#014A50',
          800: '#164E4F',
          700: '#1E7B69',
          600: '#21776A',
        },
        brand: {
          green: {
            700: '#009C62',
            500: '#07D862',
            100: '#DAF4D7',
            50:  '#ECFCEA',
          },
        },
        ink: {
          DEFAULT: '#0A0A0A',
          soft:    '#1E1E1E',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
        accent:  ['ABeeZee', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        numeral: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xs: '6px',
        xl: '24px',
        '2xl': '48px',
        pill: '999px',
      },
      boxShadow: {
        tile:
          '4px 4px 12px rgba(0,0,0,0.11), 17px 14px 22px rgba(0,0,0,0.10), 39px 32px 30px rgba(0,0,0,0.06), 69px 57px 36px rgba(0,0,0,0.02), 108px 89px 39px rgba(0,0,0,0.00)',
        soft: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
        lift: '0 8px 24px rgba(0,0,0,0.08), 0 24px 60px rgba(0,0,0,0.10)',
      },
      backgroundImage: {
        'stat-band':    'linear-gradient(180deg, #164E4F 0%, #07D862 100%)',
        'section-fade': 'linear-gradient(180deg, #DAF4D7 0%, #FFFFFF 100%)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
