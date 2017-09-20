'use strict';

const Benchmark = require('../lib/benchmark');
const createMap = require('../lib/create_map');

module.exports = class GeoJSONSetDataSmall extends Benchmark {
    setup() {
        this.data = {
            'type': 'FeatureCollection',
            'features': [{
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'Point',
                    'coordinates': [ -77.032194, 38.912753 ]
                }
            }]
        };

        return createMap({
            width: 1024,
            height: 768,
            zoom: 5,
            center: [-77.032194, 38.912753],
            style: 'mapbox://styles/mapbox/light-v9'
        }).then(map => {
            this.map = map;
            this.map.addSource('geojson', {
                'type': 'geojson',
                'data': {
                    'type': 'FeatureCollection',
                    'features': []
                }
            });
            this.map.addLayer({
                'id': 'geojson-point',
                'source': 'geojson',
                'type': 'circle',
                'filter': ['==', '$type', 'Point']
            });
        });
    }

    bench() {
        return new Promise((resolve, reject) => {
            const sourceCache = this.map.style.sourceCaches.geojson;

            sourceCache.on('data', function onData() {
                if (sourceCache.loaded()) {
                    sourceCache.off('data', onData);
                    resolve();
                }
            });

            sourceCache.getSource().setData(this.data);
        });
    }

    teardown() {
        this.map.remove();
    }
};
