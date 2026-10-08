import { fileURLToPath, URL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

const landDotsPath = fileURLToPath(
  new URL('./map files/land_dots.geojson', import.meta.url),
);

function landDotsWriter() {
  return {
    name: 'land-dots-writer',
    configureServer(server) {
      server.middlewares.use('/__save-land-dots', async (request, response, next) => {
        if (request.method !== 'POST') {
          next();
          return;
        }

        try {
          const chunks = [];
          let byteLength = 0;

          for await (const chunk of request) {
            byteLength += chunk.length;

            if (byteLength > 5 * 1024 * 1024) {
              response.statusCode = 413;
              response.end('GeoJSON is too large');
              return;
            }

            chunks.push(chunk);
          }

          const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));

          if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
            response.statusCode = 400;
            response.end('Expected a GeoJSON FeatureCollection');
            return;
          }

          await writeFile(landDotsPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

          response.statusCode = 204;
          response.end();
        } catch (error) {
          server.config.logger.error(`Could not save land dots: ${error.message}`);
          response.statusCode = 500;
          response.end('Could not save GeoJSON');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [landDotsWriter(), cesium()],
  resolve: {
    alias: {
      assert: fileURLToPath(
        new URL('./node_modules/assert/build/assert.js', import.meta.url),
      ),
    },
  },
});
