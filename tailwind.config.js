/** @type {import('tailwindcss').Config} */
export default {
  // O "content" diz ao Tailwind onde ele deve procurar por classes CSS para compilar
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Criamos as cores personalizadas baseadas no código do seu projeto original
      colors: {
        dark: {
          bg: '#0B0F19', // Fundo principal (azul quase preto)
          card: 'rgba(11, 15, 25, 0.8)', // Fundo dos modais e painéis com transparência
          border: 'rgba(255, 255, 255, 0.1)', // Bordas sutis
        }
      }
    },
  },
  plugins: [],
}
