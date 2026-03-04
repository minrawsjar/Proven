/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: {
          DEFAULT: '#030B06',
          50: '#061210',
          100: '#081A14',
          200: '#0C2218',
        },
        brand: {
          DEFAULT: '#00E676',
          light: '#69F0AE',
          dark: '#00C853',
          muted: '#00E676',
        },
        surface: {
          DEFAULT: '#0A1F14',
          card: '#0C1A12',
          hover: '#122A1C',
          border: '#1A3D28',
        },
        neon: {
          cyan: '#06b6d4',
          blue: '#3b82f6',
          purple: '#a855f7',
          pink: '#ec4899',
          green: '#00E676',
          red: '#ef4444',
          orange: '#f97316',
          yellow: '#eab308',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.4s ease-out forwards',
        'slide-in-right': 'slideInRight 0.4s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
        'ticker': 'ticker 30s linear infinite',
        'grid-fade': 'gridFade 4s ease-in-out infinite',
        'border-glow': 'borderGlow 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-dot': 'pulseDot 1.5s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
        'count-up': 'countUp 1s ease-out forwards',
        'sphere-rotate': 'sphereRotate 25s linear infinite',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { opacity: '0.3', filter: 'blur(40px)' },
          '50%': { opacity: '0.6', filter: 'blur(60px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        marqueeScroll: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-33.333%)' },
        },
        gridFade: {
          '0%, 100%': { opacity: '0.02' },
          '50%': { opacity: '0.04' },
        },
        borderGlow: {
          '0%, 100%': { borderColor: 'rgba(0,230,118,0.15)' },
          '50%': { borderColor: 'rgba(0,230,118,0.35)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.5)', opacity: '0.5' },
        },
        sphereRotate: {
          '0%': { transform: 'rotateY(0deg) rotateX(10deg)' },
          '100%': { transform: 'rotateY(360deg) rotateX(10deg)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'grid-pattern': 'linear-gradient(rgba(0,230,118,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,230,118,0.02) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '60px 60px',
      },
      boxShadow: {
        'neon-green': '0 0 20px rgba(0,230,118,0.3), 0 0 60px rgba(0,230,118,0.1)',
        'neon-green-lg': '0 0 40px rgba(0,230,118,0.25), 0 0 80px rgba(0,230,118,0.08)',
        'neon-cyan': '0 0 20px rgba(6,182,212,0.3), 0 0 60px rgba(6,182,212,0.1)',
        'neon-purple': '0 0 20px rgba(168,85,247,0.3), 0 0 60px rgba(168,85,247,0.1)',
        'neon-red': '0 0 20px rgba(239,68,68,0.3), 0 0 60px rgba(239,68,68,0.1)',
        'glow-sm': '0 0 10px rgba(0,230,118,0.15)',
        'glow-lg': '0 0 40px rgba(0,230,118,0.2), 0 0 80px rgba(0,230,118,0.05)',
        'inner-glow': 'inset 0 0 30px rgba(0,230,118,0.03)',
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,230,118,0.06)',
      },
    },
  },
  plugins: [],
}
