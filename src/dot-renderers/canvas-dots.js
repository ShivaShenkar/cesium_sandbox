const PATTERN_IMAGE_ID = "land-dots-canvas";

export function setupCanvasDots(map, {backgroundLayerId}) {
  const size = 8; // Seamless pattern dimensions must be a power of two.
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  context.fillStyle = "#061B3B";
  context.fillRect(0, 0, size, size);

  context.fillStyle = "#FFF";
  context.beginPath();
  context.arc(size / 2, size / 2, 1.25, 0, Math.PI * 2);
  context.fill();

  map.addImage(
    PATTERN_IMAGE_ID,
    context.getImageData(0, 0, size, size),
    {pixelRatio: 1},
  );
  map.setPaintProperty(
    backgroundLayerId,
    "background-pattern",
    PATTERN_IMAGE_ID,
  );

  let previousLevel = Math.floor(getNormalizedGlobeZoom(map));

  const logNormalizedZoomChange = () => {
    const currentLevel = Math.floor(getNormalizedGlobeZoom(map));

    if (currentLevel !== previousLevel) {
      console.info(`Normalized globe zoom: ${previousLevel} -> ${currentLevel}`);
      previousLevel = currentLevel;
    }
  };

  map.on("move", logNormalizedZoomChange);

  return () => {
    map.off("move", logNormalizedZoomChange);
  };
}

function getNormalizedGlobeZoom(map) {
  const latitudeRadians = map.getCenter().lat * Math.PI / 180;
  const latitudeScale = Math.max(Math.cos(latitudeRadians), 1e-6);

  return map.getZoom() - Math.log2(latitudeScale);
}
