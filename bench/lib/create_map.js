'use strict';

const util = require('../../src/util/util');
const mapboxgl = require('../../src');

mapboxgl.accessToken = require('./access_token');

module.exports = function (options) {
    return new Promise((resolve, reject) => {
        const container = document.createElement('div');
        container.style.width = `${options.width || 512}px`;
        container.style.height = `${options.width || 512}px`;
        container.style.margin = '0 auto';
        container.style.display = 'none';
        document.body.appendChild(container);

        const map = new mapboxgl.Map(util.extend({
            container,
            style: 'mapbox://styles/mapbox/streets-v9'
        }, options));

        map
            .on('load', () => resolve(map))
            .on('error', (e) => reject(e.error))
            .on('remove', () => container.remove());
    });
};
