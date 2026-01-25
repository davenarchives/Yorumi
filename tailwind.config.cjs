/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                yorumi: {
                    main: '#00A3FF',  // vibrant Blue
                    accent: '#3DB4F2', // Light Sky Blue (Anime)
                    manga: '#c084fc',  // Light Purple (Manga)
                    bg: '#0a0a0a',    // Deep Dark (Neutral)
                    text: '#ffffff',
                }
            },
            keyframes: {
                'fade-in-up': {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                }
            },
            animation: {
                'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
            }
        },
    },
    plugins: [],
}
