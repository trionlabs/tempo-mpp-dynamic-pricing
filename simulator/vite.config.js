import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [
    svelte({
      compilerOptions: {
        // 'dev:fast' runs vite --mode fast → skips Svelte dev proxies/checks
        // 'dev' runs vite (mode=development) → full dev instrumentation
        dev: mode === 'development',
      },
    }),
  ],
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, '../src'),
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
}));
