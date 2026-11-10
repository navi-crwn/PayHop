import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: { port: 5189, strictPort: true },
  preview: { port: 4189, strictPort: true },
  build: { target: 'es2022', assetsInlineLimit: 0 }
});
