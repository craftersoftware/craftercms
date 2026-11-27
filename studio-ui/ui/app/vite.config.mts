import { defineConfig } from 'vite';
import { formatjsPluginOptions } from './formatjs.config.mjs';
// import reactSwc from '@vitejs/plugin-react-swc';
import react from '@vitejs/plugin-react';
import $monacoEditorPlugin from 'vite-plugin-monaco-editor'
import babel from '@rolldown/plugin-babel';

// @ts-expect-error - TS2339: Property default does not exist on type (options: IMonacoEditorOpts) => Plugin<any>
const monacoEditorPlugin = $monacoEditorPlugin.default ?? $monacoEditorPlugin

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
      plugins: [['formatjs', formatjsPluginOptions]]
    }),
    monacoEditorPlugin({
       languageWorkers: ['editorWorkerService', 'json'],
       customWorkers: [
         {
           label: 'graphql',
           entry: 'monaco-graphql/esm/graphql.worker.js'
       }
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
    minify: true,
    outDir: '../../static-assets/app',
    emptyOutDir: true,
    sourcemap: true,
    rolldownOptions: {
      output: {
        // Without manual groups, Rolldown emits one tiny chunk per MUI component, per rxjs operator, etc. Studio is often
        // served over plain HTTP/1.1, where browsers fetch ~6 files at a time per origin, so the hundreds of files on the
        // startup path cost many round trips. These groups collapse vendor code that is always needed at startup
        // (`craftercms.libs` pulls in all of React, MUI and rxjs) into a few files.
        // Do not add a catch-all group for app code (`src/**`) or for `node_modules` in general: it drags lazily loaded
        // code (monaco, graphiql, data grid...) onto the startup path and can create cyclic chunks that break startup.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 40 },
            {
              name: 'mui',
              // Intentionally excludes @mui/icons-material (thousands of modules, ~6 MB) and the @mui/x-* packages,
              // which are lazily loaded.
              test: /node_modules[\\/](@mui[\\/](material|system|utils|styled-engine|private-theming)|@emotion|@popperjs|react-transition-group)[\\/]/,
              priority: 30
            },
            { name: 'rxjs', test: /node_modules[\\/](rxjs|redux-observable)[\\/]/, priority: 20 },
            // Only icons referenced by more than one chunk (i.e. icons statically imported by app code). Icons
            // only referenced by the lazy icon registry stay in their own on-demand chunks.
            {
              name: 'icons',
              test: /node_modules[\\/]@mui[\\/]icons-material[\\/]/,
              minShareCount: 2,
              priority: 10
            }
          ]
        }
      },
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
