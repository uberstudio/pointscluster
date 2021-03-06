'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _latLng = require('./utils/latLng');

var _createTree = require('./utils/createTree');

var _createTree2 = _interopRequireDefault(_createTree);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

var createCluster = function createCluster(x, y, points) {
  return {
    x: x, // cluster center
    y: y,
    wx: x, // weighted cluster center
    wy: y,
    zoom: Infinity, // the last zoom the cluster was processed at
    points: points,
    numPoints: points.length
  };
};

// squared distance between two points
function distSq(a, b) {
  var dx = a.wx - b.wx;
  var dy = a.wy - b.wy;
  return dx * dx + dy * dy;
}

function SuperCluster(options) {
  this.options = _extends({}, this.options, options);

  this._initTrees();
}

SuperCluster.prototype = {
  options: {
    minZoom: 0, // min zoom to generate clusters on
    maxZoom: 16, // max zoom level to cluster the points on
    radius: 40, // cluster radius in pixels
    extent: 512, // tile extent (radius is calculated relative to it)
    nodeSize: 16 // size of the R-tree leaf node, affects performance
  },

  load: function load(points) {
    // generate a cluster object for each point
    var clusters = points.map(function (_ref) {
      var pt = _objectWithoutProperties(_ref, []),
          lat = _ref.lat,
          lng = _ref.lng;

      return createCluster(lng, lat, [pt]);
    });

    // cluster points on max zoom, then cluster the results on previous zoom, etc.;
    // results in a cluster hierarchy across zoom levels
    for (var z = this.options.maxZoom; z >= this.options.minZoom; z--) {
      this.trees[z + 1].load(clusters); // index input points into an R-tree
      clusters = this._cluster(clusters, z); // create a new set of clusters for the zoom
    }
    this.trees[this.options.minZoom].load(clusters); // index top-level clusters

    return this;
  },
  getClusters: function getClusters(bbox, zoom) {
    var _this = this;

    var _bbox = _slicedToArray(bbox, 4),
        nwLng = _bbox[0],
        seLat = _bbox[1],
        seLng = _bbox[2],
        nwLat = _bbox[3];

    var z = Math.max(this.options.minZoom, Math.min(zoom, this.options.maxZoom + 1));
    var bBoxes = nwLng < seLng ? [bbox] : [[nwLng, seLat, 180, nwLat], [-180, seLat, seLng, nwLat]];

    var clusters = bBoxes.map(function (bBox) {
      return _this.trees[z].search(bBox);
    }).reduce(function (r, lst) {
      return [].concat(_toConsumableArray(r), _toConsumableArray(lst));
    }, []);

    return clusters;
  },
  _initTrees: function _initTrees() {
    this.trees = [];
    // make an R-Tree index for each zoom level
    for (var z = 0; z <= this.options.maxZoom + 1; z++) {
      this.trees[z] = (0, _createTree2.default)(this.options.nodeSize);
    }
  },
  _cluster: function _cluster(points, zoom) {
    var clusters = [];
    var r = (0, _latLng.screenDist2LatLngDist)(this.options.radius, zoom);
    var bbox = [0, 0, 0, 0];

    // loop through each point
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var clusterPoints = p.points;
      // if we've already visited the point at this zoom level, skip it
      if (p.zoom <= zoom) continue;
      p.zoom = zoom;

      // find all nearby points with a bbox search
      bbox[0] = p.wx - r;
      bbox[1] = p.wy - r;
      bbox[2] = p.wx + r;
      bbox[3] = p.wy + r;
      var bboxNeighbors = this.trees[zoom + 1].search(bbox);

      var foundNeighbors = false;
      var numPoints = p.numPoints;
      var wx = p.wx * numPoints;
      var wy = p.wy * numPoints;

      for (var j = 0; j < bboxNeighbors.length; j++) {
        var b = bboxNeighbors[j];
        // filter out neighbors that are too far or already processed
        if (zoom < b.zoom && distSq(p, b) <= r * r) {
          foundNeighbors = true;
          b.zoom = zoom; // save the zoom (so it doesn't get processed twice)
          wx += b.wx * b.numPoints; // accumulate coordinates for calculating weighted center
          wy += b.wy * b.numPoints;
          numPoints += b.numPoints;
          clusterPoints = [].concat(_toConsumableArray(clusterPoints), _toConsumableArray(b.points));
        }
      }

      if (!foundNeighbors) {
        clusters.push(p); // no neighbors, add a single point as cluster
        continue;
      }

      // form a cluster with neighbors
      var cluster = createCluster(p.x, p.y, clusterPoints);
      (0, _invariant2.default)(clusterPoints.length === numPoints, 'clusterPoints.length === numPoints');

      // save weighted cluster center for display
      cluster.wx = wx / numPoints;
      cluster.wy = wy / numPoints;

      clusters.push(cluster);
    }

    return clusters;
  }
};

var supercluster = function supercluster(points, options) {
  var cl = new SuperCluster(options);
  cl.load(points);

  return function (_ref2) {
    var _ref2$bounds = _ref2.bounds,
        nw = _ref2$bounds.nw,
        se = _ref2$bounds.se,
        zoom = _ref2.zoom;
    return cl.getClusters([nw.lng, se.lat, se.lng, nw.lat], zoom);
  };
};

exports.default = supercluster;

/*
const cl = supercluster([
  { lat: 10, lng: 10 },
  { lat: 10.1, lng: 10.1 },
  { lat: 12, lng: 12 },
  { lat: 84, lng: 179 },
]);

const r = cl({ bounds: { nw: { lat: 85, lng: -180 }, se: { lat: -85, lng: 180 } }, zoom: 2 });

console.log(JSON.stringify(r));
*/