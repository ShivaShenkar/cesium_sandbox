// =================================MapLibre ENVIRONMENT======================================
import {Map, setWorkerUrl} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {setupCanvasDots} from "./dot-renderers/canvas-dots.js";
import {setupGeoJsonDots} from "./dot-renderers/geojson-dots.js";

setWorkerUrl(workerUrl);

const DOT_RENDERERS = {
  canvas: setupCanvasDots,
  geojson: setupGeoJsonDots,
};
const requestedRenderer = new URLSearchParams(window.location.search).get("dots");
const rendererName = Object.hasOwn(DOT_RENDERERS, requestedRenderer)
  ? requestedRenderer
  : "canvas";
const setupDotRenderer = DOT_RENDERERS[rendererName];

const map = new Map({
  container: "map",
  style: "https://api.maptiler.com/maps/01a0f9ad-a7f5-7fc2-8548-a6c8d7f02b80/style.json?key=78iYskbRLqW0XlG1Ow8f",
  center: [35, 32],
  zoom: 3,
  fadeDuration: 0,
});

let removeDotRendererListeners = () => {};

map.on("style.load", () => {
  removeDotRendererListeners();
  map.setProjection({type: "globe"});

  const importedLayers = map.getStyle().layers ?? [];
  const maskLayerIds = new Set(["Water", "River"]);

  // Keep only the water masks from the imported style. The dots are inserted
  // below these layers, so water geometries cover dots outside the land.
  for (const layer of importedLayers) {
    map.setLayoutProperty(
      layer.id,
      "visibility",
      maskLayerIds.has(layer.id) ? "visible" : "none",
    );
  }

  const firstImportedLayerId = importedLayers[0]?.id;
  const firstMaskLayerId = importedLayers.find((layer) =>
    maskLayerIds.has(layer.id)
  )?.id;

  map.addLayer({
    id: "dot-globe-background",
    type: "background",
    paint: {
      "background-color": "#061B3B",
      "background-opacity": 1,
    },
  }, firstImportedLayerId);

  if (map.getLayer("Water")) {
    map.setPaintProperty("Water", "fill-pattern", null);
    map.setPaintProperty("Water", "fill-color", "#061B3B");
    map.setPaintProperty("Water", "fill-opacity", 1);
  }

  if (map.getLayer("River")) {
    map.setPaintProperty("River", "line-color", "#061B3B");
    map.setPaintProperty("River", "line-opacity", 1);
  }

  removeDotRendererListeners = setupDotRenderer(map, {
    backgroundLayerId: "dot-globe-background",
    beforeLayerId: firstMaskLayerId,
  });

  console.info(`Using ${rendererName} dot renderer`);
});
