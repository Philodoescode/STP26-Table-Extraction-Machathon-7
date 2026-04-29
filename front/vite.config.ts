import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
//import { ngrok } from 'vite-plugin-ngrok'

// https://vite.dev/config/
export default defineConfig({
    //, ngrok('3CrlL2Nqhqb1ZEaXqMzHD6iaMlf_4Fm4g9KDTgccBkLnQzqsj')
   plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
