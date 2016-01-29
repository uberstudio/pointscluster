
// longitude/latitude to spherical mercator in [0..1] range
export const lngX = (lng) => lng / 360 + 0.5;

export const latY = (lat) => {
  const sin = Math.sin(lat * Math.PI / 180);
  const y = (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);

  return y < 0
    ? 0
    : y > 1
      ? 1
      : y;
};

const TILE_SIZE = 256;

export const screenDist2LatLngDist = (dist, zoom) => {
  const scale = Math.pow(2, zoom);
  const distW = dist / scale / TILE_SIZE;
  const distLatLng = distW * 360;
  return distLatLng;
};

/*
// spherical mercator to longitude/latitude
export const xLng = (x) => (x - 0.5) * 360;

export const yLat = (y) =>
  360 * Math.atan(Math.exp((180 - y * 360) * Math.PI / 180)) / Math.PI - 90;
*/
