import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 800 }, // react-leaflet + stomp pesan ~510 kB
  server: { port: 5173, strictPort: true }, // el backend permite CORS desde http://localhost:5173
})
