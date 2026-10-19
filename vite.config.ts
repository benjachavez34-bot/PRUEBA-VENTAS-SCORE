
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En GitHub Actions, GITHUB_REPOSITORY contiene "propietario/nombre-repositorio".
// Esto asigna la base al nombre exacto del repositorio (ej. "/ventas-score/" o el repositorio de prueba),
// evitando páginas en blanco por rutas absolutas /assets/... no encontradas en GitHub Pages.
const base = process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
  : process.env.BASE_PATH || './';

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('html5-qrcode')) {
              return 'vendor-qrcode';
            }
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            return 'vendor-libs';
          }
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
});
