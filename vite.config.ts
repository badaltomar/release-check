import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    // During development the API runs separately on port 3000.
    proxy: { '/graphql': 'http://localhost:3000' },
  },
});
