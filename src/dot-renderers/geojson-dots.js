const LAND_DOT_PATTERNS = [
  {
    minZoom: 0,
    pointCount: 20000,
    url: new URL("../../map files/land_dots_20000.geojson", import.meta.url),
  },
  {
    minZoom: 5,
    pointCount: 40000,
    url: new URL("../../map files/land_dots_40000.geojson", import.meta.url),
  },
];

const SOURCE_ID = "land-dots-source";
const LAYER_ID = "land-dots";

export function setupGeoJsonDots(map, {beforeLayerId}) {
  let activePatternIndex = getDotPatternIndex(map);

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: LAND_DOT_PATTERNS[activePatternIndex].url.href,
  });

  map.addLayer({
    id: LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    paint: {
      "circle-radius": 1.25,
      "circle-color": "#ffffff",
      "circle-pitch-alignment": "map",
      "circle-pitch-scale": "map",
    },
  }, beforeLayerId);

  logActiveDotPattern(activePatternIndex);

  const updateDotPattern = () => {
    const nextPatternIndex = getDotPatternIndex(map);
    const source = map.getSource(SOURCE_ID);

    if (!source || nextPatternIndex === activePatternIndex) {
      return;
    }

    activePatternIndex = nextPatternIndex;
    source.setData(LAND_DOT_PATTERNS[nextPatternIndex].url.href);
    logActiveDotPattern(activePatternIndex);
  };

  map.on("zoom", updateDotPattern);

  return () => {
    map.off("zoom", updateDotPattern);
  };
}

function getDotPatternIndex(map) {
  return map.getZoom() < LAND_DOT_PATTERNS[1].minZoom ? 0 : 1;
}

function logActiveDotPattern(patternIndex) {
  const {minZoom, pointCount} = LAND_DOT_PATTERNS[patternIndex];
  const zoomRange = patternIndex === 0 ? "0-4" : `${minZoom}+`;

  console.info(
    `Showing ${pointCount.toLocaleString()} GeoJSON dots at zoom ${zoomRange}`,
  );
}
