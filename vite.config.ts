import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/resala-third-gathering/',
  plugins: [react()],
  preview: {
    allowedHosts: ['.sg2.manus.computer'],
  },
  build: { target: 'es2022' },
});
