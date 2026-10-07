// =================================MapLibre ENVIRONMENT======================================
import {Map , setWorkerUrl} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';


setWorkerUrl(workerUrl);
const map = new Map({
  container: "map",
  style: "https://api.maptiler.com/maps/01a0f9ad-a7f5-7fc2-8548-a6c8d7f02b80/style.json?key=78iYskbRLqW0XlG1Ow8f",
  center: [35, 32],
  zoom: 3,
});



map.on("style.load", () => {
  map.setProjection({ type: "globe" });

  const size = 8; // must be a power of two
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");

  // Land base
  ctx.fillStyle = "#06162D";
  ctx.fillRect(0, 0, size, size);

  // One dot per repeating cell
  ctx.fillStyle = "#FFF";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 1.25, 0, Math.PI * 2);
  ctx.fill();
 
  // Register it as a MapLibre pattern image.
  map.addImage("land-dots", ctx.getImageData(0, 0, size, size), {
    pixelRatio: 1,
  });

  // These are the actual layer IDs in the MapTiler style you supplied.
  map.setPaintProperty("Background", "background-pattern", "land-dots");

  // Keep ocean solid and visibly distinct.
//   map.setPaintProperty("Water", "fill-color", "#061b3b");
//   map.setPaintProperty("River", "line-color", "#061b3b");
});

    console.log(map.getProjection());

// for (const layer of map.getStyle().layers) {
//   if (layer.type === "symbol") {
//     map.setLayoutProperty(layer.id, "visibility", "none");
//   }
// }