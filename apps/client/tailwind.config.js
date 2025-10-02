/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        'mobile': {'max': '699px'}, // Custom mobile breakpoint for < 700px
      },
      colors: {
        diablo: {
          950: '#050302',
          900: '#0b0504',
          850: '#120807',
          800: '#1a0c0a',
          700: '#231110',
          600: '#2d1512',
          ember: '#b01c21',
          blood: '#7f1014',
          ash: '#3b1f1a',
          brass: '#b07932',
          gold: '#d6a860',
          parchment: '#f3e0bd'
        }
      },
      fontFamily: {
        diablo: ['"Cinzel"', '"Trajan Pro"', '"Times New Roman"', 'serif'],
        inferno: ['"UnifrakturMaguntia"', '"Cinzel"', 'serif']
      },
      boxShadow: {
        inferno: '0 0 28px rgba(153, 27, 27, 0.45)',
        ember: '0 0 16px rgba(208, 138, 63, 0.35)'
      },
      dropShadow: {
        glyph: '0 0 12px rgba(208, 138, 63, 0.4)',
        ember: '0 0 10px rgba(153, 27, 27, 0.45)'
      },
      backgroundImage: {
        'diablo-texture': "radial-gradient(circle at 20% 20%, rgba(214,168,96,0.12) 0, rgba(12,6,5,0.05) 40%, rgba(5,3,2,0.9) 100%)",
        'diablo-vignette': "radial-gradient(circle at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.5) 100%)",
      }
    },
  },
  plugins: [],
  safelist: [
    // Background colors
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-orange-500',
    'bg-teal-500',
    'bg-cyan-500',
    // Border colors
    'border-blue-500',
    'border-green-500',
    'border-yellow-500',
    'border-purple-500',
    'border-pink-500',
    'border-indigo-500',
    'border-red-500',
    'border-orange-500',
    'border-teal-500',
    'border-cyan-500',
    // Gradient colors
    'from-blue-500',
    'to-blue-600',
    'from-green-500',
    'to-green-600',
    'from-yellow-500',
    'to-yellow-600',
    'from-purple-500',
    'to-purple-600',
    'from-pink-500',
    'to-pink-600',
    'from-indigo-500',
    'to-indigo-600',
    'from-red-500',
    'to-red-600',
    'from-orange-500',
    'to-orange-600',
    'from-teal-500',
    'to-teal-600',
    'from-cyan-500',
    'to-cyan-600',
    // Timeline animation classes
    'timeline-fade-in',
    'timeline-slide-in-left',
    'timeline-slide-in-right',
    'timeline-gpu-accelerated',
    'timeline-agent-enter',
    // Agent type classes
    'agent-type-general-purpose',
    'agent-type-engineer',
    'agent-type-tester',
    'agent-type-code-reviewer',
    'agent-type-green-verifier',
    'agent-type-architect',
    'agent-type-deep-researcher',
    'agent-type-designer',
    'agent-type-business-analyst',
    'agent-type-planner',
    'agent-type-cloud-cicd',
  ]
}
