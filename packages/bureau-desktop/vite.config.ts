import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Construit le module du bureau : un fichier d'entrée (bureau.js) et un fichier par appli,
// chargé seulement au lancement de l'appli (import dynamique).
export default defineConfig({
  root: resolve(__dirname),
  base: './',
  build: {
    outDir: resolve(__dirname, '../../themes/jchable-bureau/assets/dist'),
    emptyOutDir: true,
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      input: { bureau: resolve(__dirname, 'src/main.ts') },
      output: {
        // Le code partagé avec les applis (traductions) vit dans son propre fichier : sinon les applis importeraient
        // le fichier d'entrée lui-même, que le navigateur évaluerait une seconde fois (adresse sans « ?ver= »).
        manualChunks(id: string) {
          if (/[\/]core[\/]i18n.ts$/.test(id)) return 'i18n';
          return undefined;
        },
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        // Le CSS de l'entrée garde un nom stable (le PHP le charge) ; le reste est versionné par empreinte.
        assetFileNames: (asset) => (asset.names?.includes('bureau.css') ? 'bureau.css' : 'assets/[name]-[hash][extname]'),
      },
    },
  },
});
