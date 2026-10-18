
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
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
});
