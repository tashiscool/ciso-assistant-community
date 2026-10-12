import { defineConfig, mergeConfig } from 'vite';
import base from '../../vite.config';
export default mergeConfig(base, defineConfig({
  build: {
    outDir: 'prototypes/ato-workspace/dist',
    rolldownOptions: { input: 'prototypes/ato-workspace/index.html' },
  },
}));
