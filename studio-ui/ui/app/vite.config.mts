import { defineConfig } from 'vite';
// import reactSwc from '@vitejs/plugin-react-swc';
import react from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

const proxyConfig = {
  target: 'http://localhost:8080/',
  changeOrigin: true,
  secure: true
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/studio' : '/studio/static-assets/app',
  plugins: [
    // TODO: SWC is faster, but can't use the formatjs transformer with it.
    // mode === 'development' ? react({ ... }) : reactSwc()
    react(),
    babel({
      plugins: [
        [
          'formatjs',
          {
            removeDefaultMessage: false,
            idInterpolationPattern: '[sha512:contenthash:base64:6]',
            ast: true
          }
        ]
      ]
    })
  ],
  server: {
    port: 3000,
    proxy: {
      '/studio/api': proxyConfig,
      '/static-assets': proxyConfig,
      '/studio/static-assets': proxyConfig,
      '/studio/refresh.json': proxyConfig,
      '/studio/1/plugin/': proxyConfig,
      '/studio/events': { target: 'ws://localhost:8080', changeOrigin: true, secure: true }
    }
  },
  optimizeDeps: {
		include: ['@mui/material']
  },
  build: {
    minify: false,
    outDir: '../../static-assets/app',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        login: 'pages/login.html',
        preview: 'pages/preview.html',
        legacy: 'pages/legacy.html',
        'project-tools': 'pages/project-tools.html'
      }
    }
  },
	worker: {
		format: 'es'
	}
}));
