import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const host = '127.0.0.1';
const port = Number(process.env.TILE_SERVER_PORT || 8080);
const archivePath = path.resolve(
  process.env.MBTILES_PATH ||
    path.join(
      'map files',
      'mbtiles',
      'natural-earth-uncompressed.mbtiles',
    ),
);
const tilePath = /^\/(\d+)\/(\d+)\/(\d+)\.pbf$/;

if (!existsSync(archivePath)) {
  throw new Error(
    `MBTiles archive not found: ${archivePath}\n` +
      'Create it there, or start this server with MBTILES_PATH=/path/to/file.mbtiles.',
  );
}

// The archive is read-only: this server never changes your generated tiles.
const database = new DatabaseSync(archivePath, { readOnly: true });
const getTile = database.prepare(`
  SELECT tile_data
  FROM tiles
  WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?
`);

const metadata = database
  .prepare(
    "SELECT name, value FROM metadata WHERE name IN ('name', 'format', 'minzoom', 'maxzoom', 'bounds')",
  )
  .all();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(payload));
}

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Origin': '*',
    });
    res.end();
    return;
  }

  const pathname = new URL(req.url || '/', `http://${host}`).pathname;
  if (pathname === '/health') {
    sendJson(res, 200, { archivePath, metadata, status: 'ok' });
    return;
  }

  const match = tilePath.exec(pathname);
  if (!match || !['GET', 'HEAD'].includes(req.method || '')) {
    sendJson(res, 404, {
      error: 'Use /{z}/{x}/{y}.pbf or /health',
    });
    return;
  }

  const [z, x, y] = match.slice(1).map(Number);
  if (
    !Number.isSafeInteger(z) ||
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    z < 0 ||
    z > 30
  ) {
    sendJson(res, 400, { error: 'Invalid XYZ tile coordinates' });
    return;
  }

  const tilesPerEdge = 2 ** z;
  if (x < 0 || y < 0 || x >= tilesPerEdge || y >= tilesPerEdge) {
    sendJson(res, 400, { error: 'XYZ tile coordinates are outside this zoom level' });
    return;
  }

  // Cesium requests XYZ rows; MBTiles stores its rows in TMS order.
  const tmsY = tilesPerEdge - 1 - y;
  const tile = getTile.get(z, x, tmsY);
  if (!tile) {
    res.writeHead(404, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    });
    res.end();
    return;
  }

  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600',
    // The archive is built with Tippecanoe's --no-tile-compression option.
    // Therefore no Content-Encoding header is sent.
    'Content-Type': 'application/vnd.mapbox-vector-tile',
  });
  res.end(req.method === 'HEAD' ? undefined : tile.tile_data);
});

server.listen(port, host, () => {
  console.log(`Serving ${archivePath}`);
  console.log(`Tile URL: http://${host}:${port}/{z}/{x}/{y}.pbf`);
  console.log(`Health check: http://${host}:${port}/health`);
});

function stop() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
