import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      // Performance optimizations
      target: 'es2015',
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Vendor chunks for better caching
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-dom/client')) {
              return 'react-vendor';
            }
            if (id.includes('motion') || id.includes('framer-motion')) {
              return 'motion-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'icons-vendor';
            }
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      chunkSizeWarningLimit: 1000,
      reportCompressedSize: false,
      sourcemap: false,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'motion', 'framer-motion', 'lucide-react'],
    },
    // Enable CSS code splitting
    css: {
      devSourcemap: true,
    },
  };
});
