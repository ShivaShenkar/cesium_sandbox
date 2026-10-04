import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style.css';

import VecotrTileLayer from 'ol/layer/VectorTile.js';

import Map from 'ol/Map.js';
import 'ol/ol.css';
import { apply } from 'ol-mapbox-style';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import LayerGroup from 'ol/layer/Group.js'

window.Cesium = Cesium;

const { default: OLCesium } = await import('olcs');


// const vectorStyleUrl =
//   'https://api.maptiler.com/maps/01a0f9ad-a7f5-7fc2-8548-a6c8d7f02b80/style.json?key=78iYskbRLqW0XlG1Ow8f';

// const layers = new LayerGroup();

// const map = new Map({
//   target: 'map',
// });

// await apply(map, vectorStyleUrl);
// // map.addLayer(layers);

// console.log(
//   map.getAllLayers().map((layer) => ({
//     type: layer.constructor.name,
//     olcsSkip: layer.getSource?.()?.get('olcs_skip'),
//   })),
// );

// const ol3d = new OLCesium({ map: map });
// ol3d.setEnabled(false);


// import {OLImageryProvider} from 'olcs';


const viewer = new Cesium.Viewer('cesium-container', {
  animation: false,
  baseLayer: false,
  baseLayerPicker: false,
  fullscreenButton: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  navigationHelpButton: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
});






function createDottedGlobeMaterial() {
  return Cesium.Material.fromType(Cesium.Material.DotType, {
    lightColor: Cesium.Color.WHITE,
    darkColor: Cesium.Color.fromCssColorString('#06152b'),
    repeat: new Cesium.Cartesian2(180, 90),
  });
}

// Toggle this on when you want to return to the simple procedural dot experiment.
viewer.scene.globe.material = createDottedGlobeMaterial();

window.viewer = viewer;
