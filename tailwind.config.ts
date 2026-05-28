import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#161210',
          raised: '#201c19',
          border: '#332d28',
        },
        text: {
          primary: '#e8dcc8',
          secondary: '#9a8e82',
          disabled: '#5a524c',
        },
        accent: {
          DEFAULT: '#c0522a',
          hover: '#d4633a',
        },
        destructive: {
          DEFAULT: '#a63228',
          hover: '#bf3e34',
        },
        success: '#4a7c59',
        warning: '#9a7a2e',
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', '"Courier New"', 'monospace'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      fontFeatureSettings: {
        tnum: '"tnum"',
      },
      spacing: {
        'sp-1': '4px',
        'sp-2': '8px',
        'sp-3': '12px',
        'sp-4': '16px',
        'sp-6': '24px',
        'sp-8': '32px',
        'sp-12': '48px',
        'sp-16': '64px',
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '2px',
        md: '4px',
      },
    },
  },
  plugins: [],
}

export default config
