import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/Wearable-Heart-Rate/',
  plugins: [react()],
});
