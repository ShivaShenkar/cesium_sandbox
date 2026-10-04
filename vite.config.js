import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [cesium()],
  resolve: {
    alias: {
      assert: fileURLToPath(
        new URL('./node_modules/assert/build/assert.js', import.meta.url),
      ),
    },
  },
});