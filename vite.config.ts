import { defineConfig } from 'vite';

// `base` must match the GitHub Pages repository name.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/fourthcoming/' : '/',
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 1200 }, // three.js + postprocessing, ~330 kB gzipped
});
