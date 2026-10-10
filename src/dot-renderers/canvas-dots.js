const LAYER_ID = "land-dots-webgl";
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TARGET_DOT_SPACING_PX = 12;
// A sparser lattice at globe-oriented zoom levels reduces visible ring/spiral
// artifacts while preserving the same distribution method.
const LOW_ZOOM_DOT_DENSITY = 0.5;
const LOW_ZOOM_MAX_LEVEL = 4;
// Zoom 4 needs about 731k dots to retain the target 12px spacing. Keep a
// ceiling because every dot still runs the vertex and fragment shaders.
const MAX_DOT_COUNT = 750_000;

/**
 * Draw land dots as a procedural WebGL layer rather than a background image.
 * The layer is inserted below Water, so existing water polygons mask dots
 * over oceans and lakes.
 */
export function setupCanvasDots(map, {beforeLayerId}) {
  const layer = createDotLayer(map);
  map.addLayer(layer, beforeLayerId);

  let previousZoom = Math.round(getNormalizedGlobeZoom(map));
  const logZoomChange = () => {
    const currentZoom = Math.round(getNormalizedGlobeZoom(map));

    if (currentZoom !== previousZoom) {
      console.info(`Normalized globe zoom: ${currentZoom}`);
      previousZoom = currentZoom;
    }
  };

  map.on("move", logZoomChange);

  return () => {
    map.off("move", logZoomChange);
  };
}

function createDotLayer(map) {
  return {
    id: LAYER_ID,
    type: "custom",
    renderingMode: "2d",
    // One compiled GPU program per MapLibre projection variant (globe/mercator).
    programs: new Map(),

    // Called by MapLibre for every rendered frame.
    render(gl, options) {
      const program = getProgram(this, gl, options.shaderData);
      const projection = options.defaultProjectionData;
      const normalizedZoom = getNormalizedGlobeZoom(map);
      const dotCount = getFibonacciDotCount(normalizedZoom);

      gl.useProgram(program.program);

      // MapLibre supplies the camera/projection values needed by projectTile().
      gl.uniformMatrix4fv(
        program.uniforms.projectionMatrix,
        false,
        new Float32Array(projection.mainMatrix),
      );
      setOptionalUniform(program.uniforms.fallbackMatrix, (location) =>
        gl.uniformMatrix4fv(
          location,
          false,
          new Float32Array(projection.fallbackMatrix),
        ),
      );
      setOptionalUniform(program.uniforms.tileMercatorCoords, (location) =>
        gl.uniform4fv(location, projection.tileMercatorCoords),
      );
      setOptionalUniform(program.uniforms.clippingPlane, (location) =>
        gl.uniform4fv(location, projection.clippingPlane),
      );
      setOptionalUniform(program.uniforms.projectionTransition, (location) =>
        gl.uniform1f(location, projection.projectionTransition),
      );

      // The shader calculates one Fibonacci-sphere point for each VertexID.
      gl.uniform1f(program.uniforms.dotCount, dotCount);
      gl.drawArrays(gl.POINTS, 0, dotCount);
    },

    // Called by MapLibre when the layer is removed or its style is torn down.
    onRemove(_map, gl) {
      for (const program of this.programs.values()) gl.deleteProgram(program.program);
      this.programs.clear();
    },
  };
}

/**
 * Return a stable Fibonacci-lattice level for normalized zoom.
 *
 * A zoom increase doubles the map resolution in each direction, so a similarly
 * spaced point field needs about four times as many dots. Quantizing to integer
 * levels prevents small camera changes from continuously rearranging the lattice.
 */
export function getFibonacciDotCount(normalizedZoom) {
  const level = Math.max(0, Math.round(normalizedZoom));
  const dotsAtZoomZero = Math.round(
    (Math.PI / 2) * (512 / TARGET_DOT_SPACING_PX) ** 2,
  );
  const density = level <= LOW_ZOOM_MAX_LEVEL ? LOW_ZOOM_DOT_DENSITY : 1;

  return Math.min(MAX_DOT_COUNT, Math.round(dotsAtZoomZero * 4 ** level * density));
}

/**
 * Compile and cache shaders for MapLibre's current projection.
 * Globe and mercator projections inject different projectTile() GLSL code.
 */
function getProgram(layer, gl, shaderData) {
  let program = layer.programs.get(shaderData.variantName);
  if (program) return program;

  const vertexShader = compileShader(
    gl,
    gl.VERTEX_SHADER,
    `#version 300 es
${shaderData.vertexShaderPrelude}
${shaderData.define}
uniform float u_dot_count;
uniform float u_golden_angle;

void main() {
  // VertexID is 0, 1, 2 ... N-1. It replaces a JavaScript position array.
  float index = float(gl_VertexID);
  float t = (index + 0.5) / u_dot_count;

  // Fibonacci sphere: one evenly distributed point for this index.
  float latitudeSin = 1.0 - 2.0 * t;
  // Keep intermediate angle values small. A direct index-times-golden-angle
  // loses float precision above roughly 20k dots and makes visible bands.
  const float INDEX_BLOCK_SIZE = 256.0;
  float block = floor(index / INDEX_BLOCK_SIZE);
  float indexInBlock = mod(index, INDEX_BLOCK_SIZE);
  float blockAngle = mod(INDEX_BLOCK_SIZE * u_golden_angle, 2.0 * PI);
  float longitude = mod(
    indexInBlock * u_golden_angle + block * blockAngle,
    2.0 * PI
  );
  float latitude = asin(latitudeSin);

  // Convert longitude/latitude to the 0..1 Mercator coordinates projectTile()
  // accepts for a MapLibre custom layer.
  float mercatorX = fract(longitude / (2.0 * PI) + 0.5);
  float mercatorY = 0.5 - log(tan(PI * 0.25 + latitude * 0.5)) / (2.0 * PI);
  vec2 mercatorPosition = vec2(mercatorX, mercatorY);

  gl_Position = projectTile(mercatorPosition);
  gl_PointSize = 2.5;
}`,
  );
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `#version 300 es
precision highp float;
out vec4 fragColor;

void main() {
  // gl_PointCoord is 0..1 inside the square drawn for one GL point.
  float distanceFromCentre = length(gl_PointCoord - vec2(0.5));
  float edge = fwidth(distanceFromCentre);
  float alpha = 1.0 - smoothstep(0.5 - edge, 0.5 + edge, distanceFromCentre);

  if (alpha == 0.0) discard;
  // RGB is premultiplied by alpha, which matches MapLibre's blend state.
  fragColor = vec4(alpha, alpha, alpha, alpha);
}`,
  );

  const glProgram = gl.createProgram();
  gl.attachShader(glProgram, vertexShader);
  gl.attachShader(glProgram, fragmentShader);
  gl.linkProgram(glProgram);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
    throw new Error(`Dot layer link failed: ${gl.getProgramInfoLog(glProgram)}`);
  }

  program = {
    program: glProgram,
    uniforms: {
      projectionMatrix: gl.getUniformLocation(glProgram, "u_projection_matrix"),
      fallbackMatrix: gl.getUniformLocation(glProgram, "u_projection_fallback_matrix"),
      tileMercatorCoords: gl.getUniformLocation(
        glProgram,
        "u_projection_tile_mercator_coords",
      ),
      clippingPlane: gl.getUniformLocation(glProgram, "u_projection_clipping_plane"),
      projectionTransition: gl.getUniformLocation(
        glProgram,
        "u_projection_transition",
      ),
      dotCount: gl.getUniformLocation(glProgram, "u_dot_count"),
      goldenAngle: gl.getUniformLocation(glProgram, "u_golden_angle"),
    },
  };
  layer.programs.set(shaderData.variantName, program);

  // The golden angle is constant for this shader program.
  gl.useProgram(glProgram);
  gl.uniform1f(program.uniforms.goldenAngle, GOLDEN_ANGLE);

  return program;
}

/** Compile GLSL and report the browser's shader error if compilation fails. */
function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Dot layer shader failed: ${log}`);
  }

  return shader;
}

/** Some projection uniforms exist only in MapLibre's globe shader variant. */
function setOptionalUniform(location, setValue) {
  if (location !== null) setValue(location);
}

/** Convert MapLibre's latitude-adjusted globe zoom back to a stable zoom level. */
function getNormalizedGlobeZoom(map) {
  const latitudeRadians = map.getCenter().lat * Math.PI / 180;
  const latitudeScale = Math.max(Math.cos(latitudeRadians), 1e-6);

  return map.getZoom() - Math.log2(latitudeScale);
}
