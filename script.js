// Include the required libraries in your HTML file: 
// Mapbox GL JS, Turf.js, SunCalc

mapboxgl.accessToken = 'pk.eyJ1IjoicGF0d2QwNSIsImEiOiJjbTZ2bGVhajIwMTlvMnFwc2owa3BxZHRoIn0.moDNfqMUolnHphdwsIF87w';


const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [-77.0369, 38.9072], // Washington DC
    zoom: 12
});

async function loadGeoJSON(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Error loading GeoJSON:', error);
    }
}

Promise.all([
    loadGeoJSON('DCPS.geojson'),
    loadGeoJSON('Swing.geojson'),
    loadGeoJSON('Wards.geojson')
]).then(([dcpsData, swingData, wardsData]) => {
    map.on('load', () => {
        if (dcpsData) {
            map.addSource('dcps', {
                type: 'geojson',
                data: dcpsData
            });

            map.addLayer({
                id: 'dcps-layer',
                type: 'circle',
                source: 'dcps',
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#FF0000',
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#000000'
                }
            });

            const select = document.getElementById('school-select');
            dcpsData.features.forEach(feature => {
                const option = document.createElement('option');
                option.value = JSON.stringify(feature.geometry.coordinates);
                option.textContent = feature.properties.NAME;
                select.appendChild(option);
            });

            select.addEventListener('change', () => {
    const coords = JSON.parse(select.value);
    const radius = document.getElementById('radius-select').value;

    // Highlight the selected school in yellow
    map.setPaintProperty('dcps-layer', 'circle-color', [
        'case',
        ['==', ['get', 'NAME'], select.options[select.selectedIndex].text], '#FFFF00',
        '#FF0000'
    ]);

    map.flyTo({ center: coords, zoom: 14 });
    generateIsochrone(coords, radius);

                });

            const radiusSelect = document.getElementById('radius-select');
            radiusSelect.addEventListener('change', () => {
                const coords = JSON.parse(select.value);
                const radius = radiusSelect.value;
                if (coords) {
                    generateIsochrone(coords, radius);
                }
            });
        }

        if (swingData) {
            map.addSource('swing', {
                type: 'geojson',
                data: swingData
            });

            map.addLayer({
                id: 'swing-layer',
                type: 'circle',
                source: 'swing',
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#0000FF'
                }
            });
        }

        if (wardsData) {
            map.addSource('wards', {
                type: 'geojson',
                data: wardsData
            });

            map.addLayer({
                id: 'wards-layer',
                type: 'line',
                source: 'wards',
                paint: {
                    'line-color': '#0000FF',
                    'line-width': 2,
                    'line-opacity': 1
                },
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                }
            });
        }
    });
});

async function generateIsochrone(coords, radius) {
    try {
        const query = await fetch(`https://api.mapbox.com/isochrone/v1/mapbox/driving/${coords[0]},${coords[1]}?contours_meters=${radius}&polygons=true&access_token=${mapboxgl.accessToken}`);
        const data = await query.json();

        if (map.getSource('isochrone')) {
            map.getSource('isochrone').setData(data);
        } else {
            map.addSource('isochrone', { type: 'geojson', data });
            map.addLayer({
                id: 'isochrone-layer',
                type: 'fill',
                source: 'isochrone',
                paint: {
                    'fill-color': '#8888ff',
                    'fill-opacity': 0.4
                }
            });
        }
        filterSwingLocations(data);
    } catch (error) {
        console.error('Error generating isochrone:', error);
    }
}

function filterSwingLocations(isochrone) {
    const swingFeatures = map.getSource('swing')._data.features;
    console.log('Isochrone Data:', isochrone);
    const coords = isochrone.features[0].geometry.coordinates;
    const isochronePolygon = turf.polygon(coords);
    console.log('Swing Features:', swingFeatures);
    console.log('Swing Feature Geometry:', swingFeatures.map(f => f.geometry));
    const filtered = swingFeatures.filter(feature =>
        turf.booleanPointInPolygon(feature.geometry, isochronePolygon)
    );

    document.getElementById('swing-table').innerHTML = filtered.map(f => `<tr><td>${f.properties.Site}</td></tr>`).join('');
}

