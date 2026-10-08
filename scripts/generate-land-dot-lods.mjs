import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const outputDirectory = fileURLToPath(
  new URL("../map files/", import.meta.url),
);

const patterns = [
  { fileName: "land_dots_20000.geojson", minZoom: 0, maxZoom: 4, pointCount: 20000 },
  { fileName: "land_dots_40000.geojson", minZoom: 5, maxZoom: 7, pointCount: 40000 },
];

await mkdir(outputDirectory, { recursive: true });

for (const pattern of patterns) {
  const { fileName, minZoom, maxZoom, pointCount } = pattern;
  const geoJSON = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { minZoom, maxZoom, pointCount },
        geometry: {
          type: "MultiPoint",
          coordinates: createFibonacciPoints(pointCount),
        },
      },
    ],
  };

  const outputUrl = new URL(
    `../map files/${fileName}`,
    import.meta.url,
  );

  await writeFile(outputUrl, JSON.stringify(geoJSON), "utf8");
  console.info(
    `Generated ${fileName}: ${pointCount.toLocaleString()} points for z${minZoom}–${maxZoom}`,
  );
}

function createFibonacciPoints(count) {
  const coordinates = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < count; index += 1) {
    // Offset by 0.5 so no point lies exactly on a pole.
    const y = 1 - (2 * (index + 0.5)) / count;
    const radius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * index;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;

    coordinates.push([
      Number((Math.atan2(z, x) * 180 / Math.PI).toFixed(6)),
      Number((Math.asin(y) * 180 / Math.PI).toFixed(6)),
    ]);
  }

  return coordinates;
}
