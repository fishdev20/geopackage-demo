import { GeoPackage, GeoPackageAPI, GeoPackageTileRetriever, setSqljsWasmLocateFile } from "@ngageoint/geopackage";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import {createEmpty, extend} from "ol/extent";
import { map } from "./map";
import { transformGeometryWithOptions } from "ol/format/Feature";


// setSqljsWasmLocateFile(file => file);

export const loadGeoPackage = function (e) {
  console.log(e)
  let f = e.target.files[0];
  let r = new FileReader();
  r.onload = function () {
    let array = new Uint8Array(r.result);
    loadByteArray(array);
  };
  r.readAsArrayBuffer(f);
};

async function loadByteArray(array, callback) {
  const geoPackage = await GeoPackageAPI.open(array);
  const fitExtent = createEmpty()

  const tileTableNames = await geoPackage.getTileTables();
  tileTableNames.forEach(tileTableName => {
    const tileDao = geoPackage.getTileDao(tileTableName);
    const gpr = new GeoPackageTileRetriever(tileDao, 256, 256);
    const tileLayer = new TileLayer({
      extent: [
        tileDao.tileMatrixSet.min_x,
        tileDao.tileMatrixSet.min_y,
        tileDao.tileMatrixSet.max_x,
        tileDao.tileMatrixSet.max_y
      ],
      source: new XYZ({
        wrapX: false,
        minZoom: tileDao.minWebMapZoom,
        maxZoom: tileDao.maxWebMapZoom,
        url: "{z},{x},{y}",
        tileLoadFunction(tile, src) {
          const [z, x, y] = src.split(",").map(Number);
          gpr.getTile(x, y, z).then(dataUri => tile.getImage().src = dataUri);
        },
      }),
    });
    map.getView().fit(extend(fitExtent, tileLayer.getExtent()));
    map.addLayer(tileLayer);
  });

  const featureTableNames = await geoPackage.getFeatureTables();
  featureTableNames.forEach(featureTableName => {
    const featureDao = geoPackage.getFeatureDao(featureTableName);
    const geojson = {
      type: 'FeatureCollection',
      features: []
    }
    const iterator = featureDao.queryForGeoJSONIndexedFeaturesWithBoundingBox(undefined, true);
    for (const feature of iterator) {
      feature.type = 'Feature';
      geojson.features.push(feature);
    }
    const vectorLayer = new VectorLayer({
      source: new VectorSource({
        features: new GeoJSON().readFeatures(geojson, {featureProjection: 'EPSG:3857'})
      })
    });
    map.getView().fit(extend(fitExtent, vectorLayer.getSource().getExtent()));
    map.addLayer(vectorLayer);
  });

}