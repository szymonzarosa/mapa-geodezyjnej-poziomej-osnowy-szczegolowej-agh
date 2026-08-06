// MapManager.js

import L from 'leaflet';
import proj4 from 'proj4';
import { getPl2000Zone } from './utils.js';
import { t } from './i18n.js';

export class MapManager {
    constructor(containerId) {
        this.initProj4();
        this.map = L.map(containerId, {
            center: [50.0662, 19.9142],
            zoom: 14,
            zoomControl: false
        });

        L.control.zoom({ position: 'bottomleft' }).addTo(this.map);
        L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(this.map);

        this.baseMaps = this.initBaseMaps();
        this.wmsLayers = this.initWmsLayers();
        this.baseMaps.baseOsm.addTo(this.map);

        this.initCoordinatesDisplay();
        this.initGeolocation();
        this.initUIBindings();
    }

    initProj4() {
        proj4.defs([
            ["EPSG:2176", "+proj=tmerc +lat_0=0 +lon_0=15 +k=0.999923 +x_0=5500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"],
            ["EPSG:2177", "+proj=tmerc +lat_0=0 +lon_0=18 +k=0.999923 +x_0=6500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"],
            ["EPSG:2178", "+proj=tmerc +lat_0=0 +lon_0=21 +k=0.999923 +x_0=7500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"],
            ["EPSG:2179", "+proj=tmerc +lat_0=0 +lon_0=24 +k=0.999923 +x_0=8500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"]
        ]);
		
		this.transformations = {
            5: proj4('EPSG:4326', 'EPSG:2176'),
            6: proj4('EPSG:4326', 'EPSG:2177'),
            7: proj4('EPSG:4326', 'EPSG:2178'),
            8: proj4('EPSG:4326', 'EPSG:2179')
        };
    }

    initBaseMaps() {
        return {
            baseOsm: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 22 }),
            baseOrtoGeo: L.tileLayer('https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=Raster&STYLE=default&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg', { maxZoom: 22, maxNativeZoom: 19 }),
            baseOrtoEsri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 22, maxNativeZoom: 19 }),
            baseTopoEsri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 22, maxNativeZoom: 19 }),
            baseTopoOpen: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 22, maxNativeZoom: 17 })
        };
    }

    initWmsLayers() {
        const kieg = L.tileLayer.wms('https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow', { layers: 'dzialki,numery_dzialek,budynki', format: 'image/png', transparent: true, maxZoom: 22, zIndex: 1000 });
        const adresy = L.tileLayer.wms('https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaNumeracjiAdresowej', { layers: 'prg-adresy,prg-ulice,prg-place', format: 'image/png', transparent: true, maxZoom: 22, zIndex: 1001 });

        const handleWmsError = (serviceName) => {
            console.warn(`WMS Server ${serviceName} is not responding.`);
            const searchError = document.getElementById('searchError');
            if (searchError) {
                searchError.innerText = t('wms_error').replace('{service}', serviceName);
                searchError.style.background = 'var(--warning-color)';
                searchError.style.color = '#1a1a1a';
                searchError.style.display = 'block';
                setTimeout(() => {
                    searchError.style.display = 'none';
                    searchError.style.background = 'var(--danger-color)';
                    searchError.style.color = 'white';
                }, 4000);
            }
        };

        kieg.on('tileerror', () => handleWmsError('KIEG (Działki)'));
        adresy.on('tileerror', () => handleWmsError('EMUiA (Adresy)'));

        return { layerKieg: kieg, layerAdresy: adresy };
    }

    initCoordinatesDisplay() {
        const coordWgs = document.getElementById('coord-wgs');
        const coordPl2000 = document.getElementById('coord-pl2000');
        const pl2000Label = document.getElementById('pl2000-label');
        
        let ticking = false;

        this.map.on('mousemove', (e) => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const lat = e.latlng.lat; 
                    const lng = e.latlng.lng;
                    const zoneInfo = getPl2000Zone(lng); 
                    const pl2000 = this.transformations[zoneInfo.zone].forward([lng, lat]);
                    
                    if(coordWgs) coordWgs.innerText = `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
                    if(pl2000Label) pl2000Label.innerText = `PL-2000:`;
                    if(coordPl2000) coordPl2000.innerText = `X: ${pl2000[1].toFixed(2)}, Y: ${pl2000[0].toFixed(2)}`;
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    initGeolocation() {
        let userLocationMarker = null;
        const locateBtn = document.getElementById('locateBtn');

        if (locateBtn) {
            locateBtn.addEventListener('click', () => this.map.locate({setView: true, maxZoom: 17}));
        }

        this.map.on('locationfound', (e) => { 
            if (userLocationMarker) this.map.removeLayer(userLocationMarker);
            userLocationMarker = L.circleMarker(e.latlng, { radius: 8, fillColor: "var(--accent-color)", color: "#fff", weight: 3, fillOpacity: 1 }).addTo(this.map).bindPopup(t('your_location')).openPopup(); 
        });

        this.map.on('locationerror', () => alert(t('loc_error')));
    }

    initUIBindings() {
        const baseMapRadios = document.querySelectorAll('input[name="baseMapGroup"]');
        baseMapRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.changeBaseMap(e.target.id);
            });
        });
        const toggleWmsLayer = (checkboxId, layer) => {
            const cb = document.getElementById(checkboxId);
            if (cb) {
                cb.addEventListener('change', (e) => {
                    e.target.checked ? this.map.addLayer(layer) : this.map.removeLayer(layer);
                });
            }
        };

        toggleWmsLayer('layerKieg', this.wmsLayers.layerKieg);
        toggleWmsLayer('layerAdresy', this.wmsLayers.layerAdresy);
    }

    changeBaseMap(mapId) {
        Object.values(this.baseMaps).forEach(layer => { 
            if (this.map.hasLayer(layer)) this.map.removeLayer(layer); 
        });
        
        if (this.baseMaps[mapId]) {
            this.baseMaps[mapId].addTo(this.map);
            if (this.map.hasLayer(this.wmsLayers.layerKieg)) {
                this.wmsLayers.layerKieg.bringToFront();
            }
            if (this.map.hasLayer(this.wmsLayers.layerAdresy)) {
                this.wmsLayers.layerAdresy.bringToFront();
            }
        }
    }
}