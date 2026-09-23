import { defineConfig } from 'vite';

export default defineConfig({
  base: '/logistik-camunda/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
