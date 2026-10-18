
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];

const base =
  process.env.DEPLOY_TARGET === 'firebase'
    ? '/'
    : process.env.DEPLOY_TARGET === 'github'
      ? `/${repository || 'PRUEBA-VENTAS-SCORE'}/`
      : './';

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
