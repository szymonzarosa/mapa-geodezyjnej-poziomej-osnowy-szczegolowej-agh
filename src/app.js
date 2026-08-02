import L from 'leaflet';
window.L = L;
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import proj4 from 'proj4';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './style.css';
import GeographicLib from 'geographiclib';
import { registerSW } from 'virtual:pwa-register';

// IMPORTY Z TWOICH MODUŁÓW
import { showLoader, hideLoader, escapeHTML, getPl2000Zone } from './utils.js';
import { generateReport } from './pdfReport.js';
import { initUI } from './ui.js';
import { initTutorial } from './tutorial.js';

import { osnowaData } from './dane.js';
import { zakresData } from './zakres.js';
import { wizuryData } from './wizury.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// 1. Inicjalizacja interfejsu (modale, motyw)
initUI();

// 2. Inicjalizacja PWA
registerSW({
  onNeedRefresh() { console.log('Dostępna nowa wersja aplikacji. Odśwież stronę.'); },
  onOfflineReady() { console.log('Aplikacja jest gotowa do pracy offline w terenie.'); },
});

// 3. Systemy odniesienia
proj4.defs([
    ["EPSG:2176", "+proj=tmerc +lat_0=0 +lon_0=15 +k=0.999923 +x_0=5500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"],
    ["EPSG:2177", "+proj=tmerc +lat_0=0 +lon_0=18 +k=0.999923 +x_0=6500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"],
    ["EPSG:2178", "+proj=tmerc +lat_0=0 +lon_0=21 +k=0.999923 +x_0=7500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"],
    ["EPSG:2179", "+proj=tmerc +lat_0=0 +lon_0=24 +k=0.999923 +x_0=8500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"]
]);

const osm = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 22 });
const ortoGeo = L.tileLayer('https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=Raster&STYLE=default&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg', { maxZoom: 22, maxNativeZoom: 19 });
const ortoEsri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 22, maxNativeZoom: 19 });
const topoEsri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 22, maxNativeZoom: 19 });
const topoOpen = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 22, maxNativeZoom: 17 });

const wmsKieg = L.tileLayer.wms('https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow', {
    layers: 'dzialki,numery_dzialek,budynki', format: 'image/png', transparent: true, maxZoom: 22, zIndex: 1000
});

const wmsAdresy = L.tileLayer.wms('https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaNumeracjiAdresowej', {
    layers: 'prg-adresy,prg-ulice,prg-place', 
    format: 'image/png', 
    transparent: true, 
    maxZoom: 22, 
    zIndex: 1001
});

const map = L.map('map', {
    center: [50.0662, 19.9142],
    zoom: 14, 
    layers: [osm],
    zoomControl: false
});
    
L.control.zoom({ position: 'bottomleft' }).addTo(map);
L.control.scale({metric: true, imperial: false, position: 'bottomleft'}).addTo(map);

// OBSŁUGA CHOWANIA WARSTW W PANELU
document.querySelectorAll('.accordion-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        this.classList.toggle('active');
        const content = this.nextElementSibling;
        if (content.style.display === "block") content.style.display = "none";
        else content.style.display = "block";
    });
});

const coordWgs = document.getElementById('coord-wgs');
const coordPl2000 = document.getElementById('coord-pl2000');
const pl2000Label = document.getElementById('pl2000-label');

let lastMoveTime = 0;

map.on('mousemove', function(e) {
    const now = Date.now();
    if (now - lastMoveTime < 100) return;
    lastMoveTime = now;

    const lat = e.latlng.lat; 
    const lng = e.latlng.lng;
    
    const zoneInfo = getPl2000Zone(lng); 
    const pl2000 = proj4('EPSG:4326', zoneInfo.epsg, [lng, lat]);
    
    coordWgs.innerText = `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
    pl2000Label.innerText = `PL-2000 (st. ${zoneInfo.zone}):`;
    coordPl2000.innerText = `X: ${pl2000[1].toFixed(2)}, Y: ${pl2000[0].toFixed(2)}`;
});

// NARZĘDZIE POMIAROWE
let isMeasuring = false; let measureMode = 'distance'; let measurePoints = [];
const vectorStyle = { color: '#e63946', weight: 2, dashArray: '6, 6', interactive: false };
let measurePolyline = L.polyline([], vectorStyle).addTo(map);
let measurePolygon = L.polygon([], { ...vectorStyle, fillColor: '#e63946', fillOpacity: 0.15 }).addTo(map);
let measureMarkers = L.layerGroup().addTo(map);

const measureBtn = document.getElementById('measureBtn');
const measurePanel = document.getElementById('measurePanel');
const mapContainer = document.getElementById('map');
const measureDist = document.getElementById('measure-dist');
const measureArea = document.getElementById('measure-area');
const measureClear = document.getElementById('measure-clear');
const measureUndo = document.getElementById('measure-undo');
const rowArea = document.getElementById('row-area');

L.DomEvent.disableClickPropagation(measureBtn);
L.DomEvent.disableClickPropagation(measurePanel);

function handleMeasureClick(e) { measurePoints.push(e.latlng); updateMeasurementDisplay(); }

measureBtn.addEventListener('click', () => {
    isMeasuring = !isMeasuring;
    if (isMeasuring) {
        measureBtn.style.backgroundColor = 'var(--accent-color)'; 
        measureBtn.style.color = 'white';
        mapContainer.style.cursor = 'crosshair';
        measurePanel.style.display = 'block';
        map.on('click', handleMeasureClick);
    } else {
        measureBtn.style.backgroundColor = ''; 
        measureBtn.style.color = 'var(--primary-color)';
        mapContainer.style.cursor = '';
        measurePanel.style.display = 'none';
        map.off('click', handleMeasureClick); 
        clearMeasurement();
    }
});

const measureDistLabel = document.getElementById('measure-dist-label');

document.querySelectorAll('input[name="measureMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        measureMode = e.target.value; 
        rowArea.style.display = measureMode === 'area' ? 'flex' : 'none'; 
        measureDistLabel.innerText = measureMode === 'area' ? 'Obwód:' : 'Odległość:';
        clearMeasurement();
    });
});
measureUndo.addEventListener('click', () => { if (measurePoints.length > 0) { measurePoints.pop(); updateMeasurementDisplay(); } });
measureClear.addEventListener('click', clearMeasurement);

function clearMeasurement() { measurePoints = []; updateMeasurementDisplay(); }

function updateMeasurementDisplay() {
    measureMarkers.clearLayers();
    measurePoints.forEach(pt => { L.circleMarker(pt, { radius: 4, color: '#fff', weight: 1.5, fillColor: '#e63946', fillOpacity: 1, interactive: false }).addTo(measureMarkers); });
    measurePolyline.setLatLngs(measurePoints);
    if (measureMode === 'area' && measurePoints.length > 2) measurePolygon.setLatLngs(measurePoints);
    else measurePolygon.setLatLngs([]);
    calculateMeasurement();
}

function calculateMeasurement() {
    if (measurePoints.length < 2) { 
        measureDist.innerText = '0.00 m'; 
        measureArea.innerText = '0.00 m²'; 
        return; 
    }
    
    const geod = GeographicLib.Geodesic.WGS84;
    const polygon = geod.Polygon(false);
    
    let dist = 0;
    
    for (let i = 1; i < measurePoints.length; i++) {
        const p1 = measurePoints[i-1];
        const p2 = measurePoints[i];
        const result = geod.Inverse(p1.lat, p1.lng, p2.lat, p2.lng);
        dist += result.s12;
    }

    if (measureMode === 'area' && measurePoints.length > 2) {
        const first = measurePoints[0];
        const last = measurePoints[measurePoints.length - 1];
        const closingResult = geod.Inverse(last.lat, last.lng, first.lat, first.lng);
        dist += closingResult.s12;
    }

    measureDist.innerText = dist > 1000 ? (dist / 1000).toFixed(3) + ' km' : dist.toFixed(2) + ' m';
    
    if (measureMode === 'area') {
        let area = 0;
        if (measurePoints.length > 2) {
            const polyArea = geod.Polygon(true);
            measurePoints.forEach(p => polyArea.AddPoint(p.lat, p.lng));
            const areaResult = polyArea.Compute(false, true);
            area = Math.abs(areaResult.area);
        }
        measureArea.innerText = area > 10000 ? (area / 10000).toFixed(4) + ' ha' : area.toFixed(2) + ' m²';
    }
}

// ---------------------------------------------------------
// OSNOWA GEODEZYJNA I WIZUALIZACJA
// ---------------------------------------------------------

function getOsnowaIcon(stan, nr, isPanstwowa = true) {
    let dotClass = 'dot-zniszczony';
    if (stan && stan.toLowerCase().includes('dobry')) dotClass = 'dot-dobry';
    else if (stan && stan.toLowerCase().includes('uszkodzony')) dotClass = 'dot-uszkodzony';
    
    const fillColor = isPanstwowa ? "#FFFF00" : "transparent";
    
    const svgIcon = `
        <svg viewBox="0 0 100 100" class="osnowa-svg">
            <rect x="5" y="5" width="90" height="90" fill="${fillColor}" stroke="#000000" stroke-width="10"/>
            <line x1="27.5" y1="50" x2="72.5" y2="50" stroke="#000000" stroke-width="10" stroke-linecap="butt"/>
            <line x1="50" y1="27.5" x2="50" y2="72.5" stroke="#000000" stroke-width="10" stroke-linecap="butt"/>
        </svg>
    `;
    const labelHtml = nr ? `<div class="icon-nr-label">${nr}</div>` : '';
    return L.divIcon({ className: '', html: `<div class="custom-osnowa-icon">${svgIcon}<div class="status-dot ${dotClass}"></div>${labelHtml}</div>`, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14] });
}

function getOsnowaWysokosciowaIcon(stan, nr) {
    let dotClass = 'dot-zniszczony';
    if (stan && stan.toLowerCase().includes('dobry')) dotClass = 'dot-dobry';
    else if (stan && stan.toLowerCase().includes('uszkodzony')) dotClass = 'dot-uszkodzony';
    
    const svgIcon = `
        <svg viewBox="0 0 100 100" class="osnowa-svg">
            <polygon points="5,5 95,5 50,90" fill="#0000FF" stroke="#000000" stroke-width="10" stroke-linejoin="miter"/>
            <line x1="32.5" y1="35" x2="67.5" y2="35" stroke="#FFFFFF" stroke-width="10" stroke-linecap="butt"/>
            <line x1="50" y1="17.5" x2="50" y2="52.5" stroke="#FFFFFF" stroke-width="10" stroke-linecap="butt"/>
        </svg>
    `;
    const labelHtml = nr ? `<div class="icon-nr-label">${nr}</div>` : '';
    return L.divIcon({ className: '', html: `<div class="custom-osnowa-icon">${svgIcon}<div class="status-dot ${dotClass}"></div>${labelHtml}</div>`, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14] });
}

function getOsnowaFundamentalnaIcon(stan, nr) {
    let dotClass = 'dot-zniszczony';
    if (stan && stan.toLowerCase().includes('dobry')) dotClass = 'dot-dobry';
    else if (stan && stan.toLowerCase().includes('uszkodzony')) dotClass = 'dot-uszkodzony';
    
    const svgIcon = `
        <svg viewBox="0 0 100 100" class="osnowa-svg">
            <circle cx="50" cy="50" r="45" fill="transparent" stroke="#000000" stroke-width="6"/>
            <polygon points="50,20 78,70 22,70" fill="#FFFF00" stroke="#000000" stroke-width="6"/>
            <circle cx="50" cy="53" r="5" fill="#000000"/>
        </svg>
    `;
    const labelHtml = nr ? `<div class="icon-nr-label">${nr}</div>` : '';
    return L.divIcon({ className: '', html: `<div class="custom-osnowa-icon">${svgIcon}<div class="status-dot ${dotClass}"></div>${labelHtml}</div>`, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14] });
}

function getOsnowaBazowaIcon(stan, nr) {
    let dotClass = 'dot-zniszczony';
    if (stan && stan.toLowerCase().includes('dobry')) dotClass = 'dot-dobry';
    else if (stan && stan.toLowerCase().includes('uszkodzony')) dotClass = 'dot-uszkodzony';
    
    const svgIcon = `
        <svg viewBox="0 0 100 100" class="osnowa-svg">
            <polygon points="10,15 90,15 50,85" fill="#0000FF" stroke="#0000FF" stroke-width="5" stroke-linejoin="miter"/>
            <circle cx="50" cy="40" r="6" fill="#FFFFFF"/>
        </svg>
    `;
    const labelHtml = nr ? `<div class="icon-nr-label">${nr}</div>` : '';
    return L.divIcon({ className: '', html: `<div class="custom-osnowa-icon">${svgIcon}<div class="status-dot ${dotClass}"></div>${labelHtml}</div>`, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14] });
}

function getOsnowaPomiarowaIcon(stan, nr) {
    let dotClass = 'dot-zniszczony';
    if (stan && stan.toLowerCase().includes('dobry')) dotClass = 'dot-dobry';
    else if (stan && stan.toLowerCase().includes('uszkodzony')) dotClass = 'dot-uszkodzony';
    
    const svgIcon = `
        <svg viewBox="0 0 100 100" class="pomiarowa-svg">
            <circle cx="50" cy="65" r="30" fill="transparent" stroke="#000000" stroke-width="8"/>
            <line x1="50" y1="35" x2="50" y2="5" stroke="#000000" stroke-width="8" stroke-linecap="round"/>
        </svg>
    `;
    const labelHtml = nr ? `<div class="icon-nr-label">${nr}</div>` : '';
    return L.divIcon({ className: '', html: `<div class="custom-osnowa-icon">${svgIcon}<div class="status-dot ${dotClass}"></div>${labelHtml}</div>`, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14] });
}

const clusterOptions = { 
    disableClusteringAtZoom: 16, 
    spiderfyOnMaxZoom: true, 
    showCoverageOnHover: false,
    zoomToBoundsOnClick: false
};
const warstwaPanstwowa = L.markerClusterGroup(clusterOptions).addTo(map);
const warstwaSkulich = L.markerClusterGroup(clusterOptions).addTo(map);
const warstwaSkulichSzczegolowa = L.markerClusterGroup(clusterOptions).addTo(map);
const warstwaKuzniar = L.markerClusterGroup(clusterOptions).addTo(map);
const warstwaStarzykiewicz = L.markerClusterGroup(clusterOptions).addTo(map);
const warstwaKryusCalka = L.markerClusterGroup(clusterOptions).addTo(map);
const warstwaWysokosciowa = L.markerClusterGroup(clusterOptions).addTo(map);
const warstwaFundamentalna = L.markerClusterGroup(clusterOptions).addTo(map);
const warstwaBazowa = L.markerClusterGroup(clusterOptions).addTo(map);
const wizuryDobreLayer = L.featureGroup();
const wizuryUtrudnioneLayer = L.featureGroup();
const zakresLayer = L.featureGroup();

function handleClusterClick(a) {
    a.layer.spiderfy();
}

warstwaPanstwowa.on('clusterclick', handleClusterClick);
warstwaSkulich.on('clusterclick', handleClusterClick);
warstwaSkulichSzczegolowa.on('clusterclick', handleClusterClick);
warstwaKuzniar.on('clusterclick', handleClusterClick);
warstwaStarzykiewicz.on('clusterclick', handleClusterClick);
warstwaKryusCalka.on('clusterclick', handleClusterClick);
warstwaWysokosciowa.on('clusterclick', handleClusterClick);
warstwaFundamentalna.on('clusterclick', handleClusterClick);
warstwaBazowa.on('clusterclick', handleClusterClick);

const allMarkersData = []; const pointsLayer = {};

function processMarkerData(row, wgsCoords, fromLocalJS) {
    const latlng = [wgsCoords[1], wgsCoords[0]];
    
    const nr = (row.numer_punktu || row.Nr || 'Brak').toString().trim();
    const x_val = parseFloat(row.x_pl2000 || row.X);
    const y_val = parseFloat(row.y_pl2000 || row.Y);
    const h_val = parseFloat(row.h_evrf2007 || row.H);
    const dx_val = parseFloat(row.dx || row.dX);
    const dy_val = parseFloat(row.dy || row.dY);
    const stan_val = (row.stan_znaku || row.stan || '');
    const zrodlo_val = (row.zrodlo_danych || row.uwagi || '').toLowerCase();
    const klasa_val = (row.klasa_punktu || '').toLowerCase();
    const stabilizacja_val = (row.rodzaj_stabilizacji || row.notatka || '');
    const typ_znaku_val = (row.typ_znaku || '');
    
    let targetGroup; 
    let isPanstwowa = true;
    let markerIcon;

    if (klasa_val.includes('fundamentalna')) {
        targetGroup = warstwaFundamentalna;
        markerIcon = getOsnowaFundamentalnaIcon(stan_val, nr);
    } 
    else if (klasa_val.includes('bazowa')) {
        targetGroup = warstwaBazowa;
        markerIcon = getOsnowaBazowaIcon(stan_val, nr);
    }
    else if (klasa_val.includes('wysokościowa') || klasa_val.includes('wysokosciowa')) {
        targetGroup = warstwaWysokosciowa;
        markerIcon = getOsnowaWysokosciowaIcon(stan_val, nr);
    } 
    else if (klasa_val.includes('pomiarowa') || zrodlo_val.includes('kryus') || zrodlo_val.includes('całka')) {
        markerIcon = getOsnowaPomiarowaIcon(stan_val, nr);
        isPanstwowa = false;
        
        if (zrodlo_val.includes('kryus') || zrodlo_val.includes('całka')) {
            targetGroup = warstwaKryusCalka;
        } else {
            targetGroup = warstwaSkulich;
        }
    } 
    else {
        if (zrodlo_val.includes('skulich')) {
            isPanstwowa = false;
            targetGroup = warstwaSkulichSzczegolowa;
        }
        else if (zrodlo_val.includes('kuzniar') || zrodlo_val.includes('kuźniar')) {
            isPanstwowa = false;
            targetGroup = warstwaKuzniar;
        }
        else if (zrodlo_val.includes('starzykiewicz')) {
            isPanstwowa = false;
            targetGroup = warstwaStarzykiewicz;
        }
        else {
            isPanstwowa = true;
            targetGroup = warstwaPanstwowa;
        }
        markerIcon = getOsnowaIcon(stan_val, nr, isPanstwowa);
    }
    
    const marker = L.marker(latlng, { icon: markerIcon });
    pointsLayer[nr.toUpperCase()] = marker;

    let badgeClass = 'badge-zniszczony'; let stanWizualny = 'ZNISZCZONY';
    if (stan_val && stan_val.toLowerCase().includes('dobry')) { badgeClass = 'badge-dobry'; stanWizualny = 'ZACHOWANY'; } 
    else if (stan_val && stan_val.toLowerCase().includes('uszkodzony')) { badgeClass = 'badge-uszkodzony'; stanWizualny = 'USZKODZONY'; }

    const popLat = latlng[0]; const popLng = latlng[1];
    const isPodstawowa = klasa_val.includes('fundamentalna') || klasa_val.includes('bazowa');
    const precisionXY = isPodstawowa ? 4 : 2;
    const precisionH = isPodstawowa ? 4 : 3;
	
    const wysokoscText = (!isNaN(h_val)) ? `${h_val.toFixed(precisionH)} m` : 'Brak danych';
    const xText = (!isNaN(x_val)) ? `${x_val.toFixed(precisionXY)} m` : 'Brak danych';
    const yText = (!isNaN(y_val)) ? `${y_val.toFixed(precisionXY)} m` : 'Brak danych';

    let contentString = `
    <div class="popup-content">
        <div class="popup-header"><span>Punkt Osnowy ${nr}</span><span class="badge ${badgeClass}">${stanWizualny}</span></div>
        <div class="popup-body">
            <table class="popup-table">
                <tr><th>Typ znaku:</th><td>${escapeHTML(typ_znaku_val)}</td></tr>
                <tr><th>Rodzaj stabilizacji:</th><td>${escapeHTML(stabilizacja_val)}</td></tr>
                <tr><th>Wysokość H (PL-EVRF2007-NH):</th><td>${wysokoscText}</td></tr>
                <tr><th>X (PL-2000 strefa 7):</th><td>${xText}</td></tr>
                <tr><th>Y (PL-2000 strefa 7):</th><td>${yText}</td></tr>`;

    if ((stanWizualny === 'ZACHOWANY' || stanWizualny === 'USZKODZONY') && !isNaN(dx_val) && !isNaN(dy_val)) {
        contentString += `<tr><th>Błąd dX / dY:</th><td>${dx_val.toFixed(2)} / ${dy_val.toFixed(2)} m</td></tr>`;
    }
    
    contentString += `
                <tr><th>Klasa osnowy:</th><td>${escapeHTML(klasa_val || 'szczegółowa')}</td></tr>
                <tr><th>Źródło danych:</th><td>${escapeHTML(row.zrodlo_danych || row.uwagi || '')}</td></tr>
            </table>
            
            <div class="topo-section">
                <div class="topo-title">Opis topograficzny</div>
                <div class="pdf-actions">
                    <a href="szkice/${nr}.pdf" target="_blank" class="action-btn btn-pdf">Wyświetl PDF</a>
                    <a href="szkice/${nr}.jpg" target="_blank" class="action-btn btn-png">Wyświetl JPG</a>
                </div>
            </div>

            <div class="topo-section">
                <div class="topo-title">Mapa porównania z terenem</div>
                <div class="pdf-action">
                    <a href="porownania/${nr}.pdf" target="_blank" class="action-btn btn-pdf">Wyświetl PDF</a>
                </div>
            </div>

            <div class="topo-section">
                <div class="topo-title">Nawigacja do punktu</div>
                <div class="pdf-actions">
                    <a href="https://www.google.com/maps/search/?api=1&query=${popLat},${popLng}" target="_blank" class="action-btn" style="background-color: #4285F4; color: white; border: none;">Google Maps</a>
                    <a href="http://maps.apple.com/?daddr=${popLat},${popLng}" target="_blank" class="action-btn" style="background-color: #000000; color: white; border: none;">Apple Maps</a>
                </div>
            </div>
            
            <div class="topo-section section-raport">
                <div class="topo-title">Generowanie raportu</div>
                <div class="pdf-actions" id="report-btn-container"></div>
            </div>
        </div>
    </div>`;

    const popupWrapper = document.createElement('div');
    popupWrapper.innerHTML = contentString;

    const reportBtn = document.createElement('button');
    reportBtn.className = 'action-btn btn-nav';
    reportBtn.style.cssText = 'width: 100%; border:none; cursor:pointer;';
    reportBtn.innerText = 'Pobierz metryczkę (PDF)';

    reportBtn.addEventListener('click', () => {
        generateReport(nr, popLng, x_val, y_val, h_val, typ_znaku_val, stabilizacja_val, stanWizualny, klasa_val);
    });

    popupWrapper.querySelector('#report-btn-container').appendChild(reportBtn);

    marker.bindPopup(popupWrapper);
    marker.feature = { type: "Feature", geometry: { type: "Point", coordinates: wgsCoords }, properties: row };

    allMarkersData.push({ layer: marker, props: row, targetGroup: targetGroup, isLocal: fromLocalJS });
    targetGroup.addLayer(marker);
}

async function initData() {
    let successFromSupabase = false;
    showLoader('Pobieranie punktów osnowy...');

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/osnowa?select=*`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const data = await response.json();
        
        if (data && data.length > 0) {
            data.forEach(row => {
                const wgsCoords = proj4('EPSG:2178', 'EPSG:4326', [parseFloat(row.y_pl2000), parseFloat(row.x_pl2000)]);
                processMarkerData(row, wgsCoords, false);
            });
            successFromSupabase = true;
        }
    } catch (e) { 
        console.warn("Supabase niedostępne, używam danych lokalnych."); 
    }

    if (!successFromSupabase) {
        if (typeof osnowaData !== 'undefined' && osnowaData.features) {
            osnowaData.features.forEach(f => {
                processMarkerData(f.properties, f.geometry.coordinates, true);
            });
        } else {
            console.error("Brak danych lokalnych osnowaData!");
        }
    }

    if (typeof zakresData !== 'undefined') {
        L.geoJSON(zakresData, { style: { color: "#a629c6", weight: 3, fillOpacity: 0.02 } }).addTo(zakresLayer);
        if (document.getElementById('layerZakres')?.checked) map.addLayer(zakresLayer);
    }
    
    if (typeof wizuryData !== 'undefined') {
        L.geoJSON(wizuryData, { 
            coordsToLatLng: function (coords) {
                const wgs = proj4('EPSG:2178', 'EPSG:4326', [coords[0], coords[1]]);
                return new L.LatLng(wgs[1], wgs[0]);
            },
            style: function(feature) {
                if (feature.properties && feature.properties.typ === 'utrudniona') {
                    return { color: "#ef4444", weight: 2, opacity: 0.9, dashArray: "5, 5" };
                }
                return { color: "#ef4444", weight: 2, opacity: 0.9 };
            },
            onEachFeature: function(feature, layer) {
                if (feature.properties && feature.properties.typ === 'utrudniona') {
                    wizuryUtrudnioneLayer.addLayer(layer);
                } else {
                    wizuryDobreLayer.addLayer(layer);
                }
            }
        });
        if (document.getElementById('layerWizuryDobre')?.checked) map.addLayer(wizuryDobreLayer);
        if (document.getElementById('layerWizuryUtrudnione')?.checked) map.addLayer(wizuryUtrudnioneLayer);
    }

    const allLayersArray = [warstwaPanstwowa, warstwaSkulich, warstwaKuzniar, warstwaStarzykiewicz, warstwaKryusCalka, warstwaWysokosciowa].filter(l => l.getLayers().length > 0);
    
    if (allLayersArray.length > 0) {
        const group = L.featureGroup(allLayersArray);
        if (Object.keys(group._layers).length > 0) {
            map.fitBounds(group.getBounds(), { padding: [40, 40] });
        }
    }
    hideLoader();
}

initData();

// OBSŁUGA INTERFEJSU
const baseMapRadios = document.querySelectorAll('input[name="baseMapGroup"]');
const baseMapsDict = { 'baseOsm': osm, 'baseOrtoGeo': ortoGeo, 'baseOrtoEsri': ortoEsri, 'baseTopoEsri': topoEsri, 'baseTopoOpen': topoOpen };

baseMapRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        Object.values(baseMapsDict).forEach(layer => { if (map.hasLayer(layer)) map.removeLayer(layer); });
        if (this.checked && baseMapsDict[this.id]) {
            map.addLayer(baseMapsDict[this.id]);
            if (map.hasLayer(wmsKieg)) wmsKieg.bringToFront();
        }
    });
});

function toggleLayer(checkboxId, layerGroup) {
    document.getElementById(checkboxId).addEventListener('change', function() {
        if(this.checked) map.addLayer(layerGroup); else map.removeLayer(layerGroup); 
    });
}
toggleLayer('layerPanstwowa', warstwaPanstwowa); 
toggleLayer('layerSkulich', warstwaSkulich);
toggleLayer('layerSkulichSzczegolowa', warstwaSkulichSzczegolowa);
toggleLayer('layerKuzniar', warstwaKuzniar);
toggleLayer('layerStarzykiewicz', warstwaStarzykiewicz);
toggleLayer('layerKryusCalka', warstwaKryusCalka);
toggleLayer('layerWysokosciowa', warstwaWysokosciowa);
toggleLayer('layerFundamentalna', warstwaFundamentalna);
toggleLayer('layerBazowa', warstwaBazowa);
toggleLayer('layerKieg', wmsKieg);
toggleLayer('layerAdresy', wmsAdresy);
toggleLayer('layerWizuryDobre', wizuryDobreLayer);
toggleLayer('layerWizuryUtrudnione', wizuryUtrudnioneLayer);
toggleLayer('layerZakres', zakresLayer);

const panelDiv = document.getElementById('layersPanel');
L.DomEvent.disableClickPropagation(panelDiv); L.DomEvent.disableScrollPropagation(panelDiv);

// ==========================================
// WYSZUKIWARKA
// ==========================================
const searchInput = document.getElementById('searchInput');
const searchError = document.getElementById('searchError');
const searchBtn = document.getElementById('searchBtn');
const customSuggestions = document.getElementById('customSuggestions');

function searchPoint() {
    const inputRaw = searchInput.value;
    const input = inputRaw.trim().toUpperCase();
    const targetLayer = pointsLayer[input];
    
    if (targetLayer) {
        searchError.style.display = 'none';
        
        if (warstwaPanstwowa.hasLayer(targetLayer) && !map.hasLayer(warstwaPanstwowa)) { map.addLayer(warstwaPanstwowa); document.getElementById('layerPanstwowa').checked = true; }
        if (warstwaSkulich.hasLayer(targetLayer) && !map.hasLayer(warstwaSkulich)) { map.addLayer(warstwaSkulich); document.getElementById('layerSkulich').checked = true; }
        if (warstwaSkulichSzczegolowa.hasLayer(targetLayer) && !map.hasLayer(warstwaSkulichSzczegolowa)) { map.addLayer(warstwaSkulichSzczegolowa); document.getElementById('layerSkulichSzczegolowa').checked = true; }
        if (warstwaKuzniar.hasLayer(targetLayer) && !map.hasLayer(warstwaKuzniar)) { map.addLayer(warstwaKuzniar); document.getElementById('layerKuzniar').checked = true; }
        if (warstwaStarzykiewicz.hasLayer(targetLayer) && !map.hasLayer(warstwaStarzykiewicz)) { map.addLayer(warstwaStarzykiewicz); document.getElementById('layerStarzykiewicz').checked = true; }
        if (warstwaKryusCalka.hasLayer(targetLayer) && !map.hasLayer(warstwaKryusCalka)) { map.addLayer(warstwaKryusCalka); document.getElementById('layerKryusCalka').checked = true; }
        if (warstwaWysokosciowa.hasLayer(targetLayer) && !map.hasLayer(warstwaWysokosciowa)) { map.addLayer(warstwaWysokosciowa); document.getElementById('layerWysokosciowa').checked = true; }
		if (warstwaFundamentalna.hasLayer(targetLayer) && !map.hasLayer(warstwaFundamentalna)) { map.addLayer(warstwaFundamentalna); document.getElementById('layerFundamentalna').checked = true; }
		if (warstwaBazowa.hasLayer(targetLayer) && !map.hasLayer(warstwaBazowa)) { map.addLayer(warstwaBazowa); document.getElementById('layerBazowa').checked = true; }
        
        map.setView(targetLayer.getLatLng(), 19, { animate: false });
        targetLayer.openPopup();
    } else if (input !== "") {
        searchError.innerText = "Nie znaleziono punktu: " + escapeHTML(inputRaw); 
        searchError.style.display = 'block'; 
        setTimeout(() => { searchError.style.display = 'none'; }, 3000);
    }
}

window.searchPoint = searchPoint;

if (searchBtn) {
    searchBtn.addEventListener('click', searchPoint);
}

if (searchInput) {
    searchInput.addEventListener("keyup", function(e) { 
        if (e.key === "Enter") {
            searchPoint(); 
        }
    });
}

// ==========================================
// FILTRY STANU
// ==========================================
const filterDobry = document.getElementById('filterDobry');
const filterUszkodzony = document.getElementById('filterUszkodzony');
const filterZniszczony = document.getElementById('filterZniszczony');

function applyStateFilters() {
    warstwaPanstwowa.clearLayers();
    warstwaSkulich.clearLayers();
    warstwaSkulichSzczegolowa.clearLayers();
    warstwaKuzniar.clearLayers();
    warstwaStarzykiewicz.clearLayers();
    warstwaKryusCalka.clearLayers();
    warstwaWysokosciowa.clearLayers();
	warstwaFundamentalna.clearLayers();
	warstwaBazowa.clearLayers();

    const showDobry = filterDobry.checked;
    const showUszkodzony = filterUszkodzony.checked;
    const showZniszczony = filterZniszczony.checked;

    allMarkersData.forEach(item => {
        const row = item.props;
        const stan = (row.stan_znaku || row.stan || '').toLowerCase();
        
        let stanWizualny = 'zniszczony';
        if (stan.includes('dobry')) stanWizualny = 'dobry';
        else if (stan.includes('uszkodzony')) stanWizualny = 'uszkodzony';

        let isVisible = false;
        if (stanWizualny === 'dobry' && showDobry) isVisible = true;
        if (stanWizualny === 'uszkodzony' && showUszkodzony) isVisible = true;
        if (stanWizualny === 'zniszczony' && showZniszczony) isVisible = true;

        if (isVisible) {
            item.targetGroup.addLayer(item.layer);
        }
    });
}

[filterDobry, filterUszkodzony, filterZniszczony].forEach(cb => {
    if(cb) cb.addEventListener('change', applyStateFilters);
});

// ==========================================
// GEOLOKALIZACJA
// ==========================================
let userLocationMarker = null;
const locateBtn = document.getElementById('locateBtn');

if (locateBtn) {
    locateBtn.addEventListener('click', function() { 
        map.locate({setView: true, maxZoom: 17}); 
    });
}

map.on('locationfound', function(e) { 
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
    }
    
    userLocationMarker = L.circleMarker(e.latlng, { 
        radius: 8, 
        fillColor: "var(--accent-color)", 
        color: "#fff", 
        weight: 3, 
        fillOpacity: 1 
    }).addTo(map).bindPopup("Twoja aktualna lokalizacja").openPopup(); 
});

map.on('locationerror', function(e) {
    alert("Nie udało się pobrać lokalizacji. Sprawdź, czy przeglądarka ma odpowiednie uprawnienia.");
});

// ==========================================
// LEGENDA
// ==========================================
const legend = L.control({position: 'bottomright'});
legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend ui-panel');
    
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    div.innerHTML = `
        <div id="legend-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
            <b style="margin-bottom: 0;">Legenda</b>
            <svg id="legend-icon" style="width: 14px; height: 14px; transition: transform 0.3s; margin-left: 15px; color: #6b7280;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
        <div id="legend-content" style="margin-top: 10px; display: block;">
            <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><rect x="5" y="5" width="90" height="90" fill="#FFFF00" stroke="#000000" stroke-width="10"/><line x1="27.5" y1="50" x2="72.5" y2="50" stroke="#000000" stroke-width="10" stroke-linecap="butt"/><line x1="50" y1="27.5" x2="50" y2="72.5" stroke="#000000" stroke-width="10" stroke-linecap="butt"/></svg>Osnowa Szczegółowa (Państwowa)</div>
            <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><rect x="5" y="5" width="90" height="90" fill="transparent" stroke="#000000" stroke-width="10"/><line x1="27.5" y1="50" x2="72.5" y2="50" stroke="#000000" stroke-width="10" stroke-linecap="butt"/><line x1="50" y1="27.5" x2="50" y2="72.5" stroke="#000000" stroke-width="10" stroke-linecap="butt"/></svg>Osnowa Szczegółowa (Inne)</div>
            <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><polygon points="5,5 95,5 50,90" fill="#0000FF" stroke="#000000" stroke-width="10" stroke-linejoin="miter"/><line x1="32.5" y1="35" x2="67.5" y2="35" stroke="#FFFFFF" stroke-width="10" stroke-linecap="butt"/><line x1="50" y1="17.5" x2="50" y2="52.5" stroke="#FFFFFF" stroke-width="10" stroke-linecap="butt"/></svg>Osnowa Szczegółowa Wysokościowa</div>
            <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><circle cx="50" cy="50" r="45" fill="transparent" stroke="#000000" stroke-width="6"/><polygon points="50,20 78,70 22,70" fill="#FFFF00" stroke="#000000" stroke-width="6"/><circle cx="50" cy="53" r="5" fill="#000000"/></svg>Osnowa Fundamentalna Pozioma</div>
			<div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><polygon points="10,15 90,15 50,85" fill="#0000FF" stroke="#0000FF" stroke-width="5" stroke-linejoin="miter"/><circle cx="50" cy="40" r="6" fill="#FFFFFF"/></svg>Osnowa Bazowa Wysokościowa</div>
			<div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg" style="border-radius:50%;"><circle cx="50" cy="65" r="30" fill="transparent" stroke="#000000" stroke-width="8"/><line x1="50" y1="35" x2="50" y2="5" stroke="#000000" stroke-width="8" stroke-linecap="round"/></svg>Osnowa Pomiarowa</div>
            <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><rect x="5" y="5" width="90" height="90" fill="transparent" stroke="#a629c6" stroke-width="15"/></svg>Zakres opracowania</div>
            <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><line x1="0" y1="50" x2="100" y2="50" stroke="#ef4444" stroke-width="12"/></svg>Wizury dobre</div>
            <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><line x1="0" y1="50" x2="100" y2="50" stroke="#ef4444" stroke-width="12" stroke-dasharray="20, 20"/></svg>Wizury utrudnione</div>
            <div style="margin-top: 10px;"></div>
            <div class="legend-item"><div class="status-dot dot-dobry" style="position:relative; margin-right:12px; margin-left:4px;"></div>Punkty Zachowane</div>
            <div class="legend-item"><div class="status-dot dot-uszkodzony" style="position:relative; margin-right:12px; margin-left:4px;"></div>Punkty Uszkodzone</div>
            <div class="legend-item"><div class="status-dot dot-zniszczony" style="position:relative; margin-right:12px; margin-left:4px;"></div>Punkty Zniszczone</div>
            <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 9px; font-weight: 700; color: #6b7280; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">Kraków, 2026 r.</div>
        </div>
    `;
    return div;
};
legend.addTo(map);

const legendHeader = document.getElementById('legend-header');
const legendContent = document.getElementById('legend-content');
const legendIcon = document.getElementById('legend-icon');
const isMobile = window.innerWidth <= 950 || window.innerHeight <= 550;

function toggleLegend(forceClose = false) {
    if (legendContent.style.display === 'none' && !forceClose) {
        legendContent.style.display = 'block';
        legendIcon.style.transform = 'rotate(180deg)';
    } else {
        legendContent.style.display = 'none';
        legendIcon.style.transform = 'rotate(0deg)';
    }
}

if (legendHeader) legendHeader.addEventListener('click', () => toggleLegend());

if (isMobile) {
    toggleLegend(true);
} else {
    if (legendIcon) legendIcon.style.transform = 'rotate(180deg)';
}

map.fire('zoomend');

// ==========================================
// EKSPORT DANYCH
// ==========================================
let exportSelectionBox = null; 
let exportSelectionBounds = null; 
let selectionStartPoint = null; 
let isDrawingExportBox = false;

const selectAreaBtn = document.getElementById('selectAreaBtn');
const exportFloatingPanel = document.getElementById('exportFloatingPanel');
const exportInstructions = document.getElementById('exportInstructions');
const exportActionButtons = document.getElementById('exportActionButtons');
const floatExportCancel = document.getElementById('floatExportCancel');
const floatExportCsv = document.getElementById('floatExportCsv');
const floatExportGeoJson = document.getElementById('floatExportGeoJson');

if (selectAreaBtn) {
    selectAreaBtn.addEventListener('click', () => {
        const layersPanel = document.getElementById('layersPanel');
        if (layersPanel) layersPanel.classList.remove('mobile-active');

        isDrawingExportBox = true;
        selectionStartPoint = null;
        mapContainer.style.cursor = 'crosshair';
        
        if (exportFloatingPanel) exportFloatingPanel.style.display = 'flex';
        if (exportActionButtons) exportActionButtons.style.display = 'none';
        if (exportInstructions) exportInstructions.innerText = "Kliknij w pierwszy róg obszaru na mapie...";
    });
}

map.on('click', function(e) {
    if (!isDrawingExportBox) return;

    if (!selectionStartPoint) {
        selectionStartPoint = e.latlng; 
        exportSelectionBox = L.rectangle([selectionStartPoint, selectionStartPoint], { 
            color: "var(--success-color)", 
            weight: 2, 
            fillOpacity: 0.2, 
            interactive: false 
        }).addTo(map);
        if (exportInstructions) exportInstructions.innerText = "Teraz kliknij w drugi (przeciwległy) róg.";
    } else {
        exportSelectionBox.setBounds([selectionStartPoint, e.latlng]);
        exportSelectionBounds = exportSelectionBox.getBounds(); 
        isDrawingExportBox = false; 
        mapContainer.style.cursor = '';
        
        if (exportInstructions) exportInstructions.innerText = "Obszar zaznaczony. Wybierz format zapisu:";
        if (exportActionButtons) exportActionButtons.style.display = 'flex';
    }
});

map.on('mousemove', function(e) {
    if (isDrawingExportBox && selectionStartPoint && exportSelectionBox) {
        exportSelectionBox.setBounds([selectionStartPoint, e.latlng]);
    }
});

function clearExportSelection() { 
    isDrawingExportBox = false; 
    selectionStartPoint = null; 
    mapContainer.style.cursor = '';
    if (exportFloatingPanel) exportFloatingPanel.style.display = 'none';
    if (exportSelectionBox) { 
        map.removeLayer(exportSelectionBox); 
        exportSelectionBox = null; 
        exportSelectionBounds = null; 
    } 
}

if (floatExportCancel) floatExportCancel.addEventListener('click', clearExportSelection);

function getVisibleFeatures() {
    let features = []; 
    const activeGroups = [ 
        { layer: warstwaPanstwowa, checkboxId: 'layerPanstwowa' }, 
        { layer: warstwaSkulich, checkboxId: 'layerSkulich' },
        { layer: warstwaSkulichSzczegolowa, checkboxId: 'layerSkulichSzczegolowa' },
        { layer: warstwaKuzniar, checkboxId: 'layerKuzniar' },
        { layer: warstwaStarzykiewicz, checkboxId: 'layerStarzykiewicz' },
        { layer: warstwaKryusCalka, checkboxId: 'layerKryusCalka' },
        { layer: warstwaWysokosciowa, checkboxId: 'layerWysokosciowa' },
		{ layer: warstwaFundamentalna, checkboxId: 'layerFundamentalna' },
		{ layer: warstwaBazowa, checkboxId: 'layerBazowa' }
    ];
    activeGroups.forEach(group => {
        const checkbox = document.getElementById(group.checkboxId);
        if (checkbox && checkbox.checked) {
            group.layer.eachLayer(marker => {
                if (marker.feature) {
                    if (exportSelectionBounds) { 
                        if (exportSelectionBounds.contains(marker.getLatLng())) features.push(marker.feature); 
                    } else {
                        features.push(marker.feature);
                    }
                }
            });
        }
    });
    return features;
}

function exportToCsv() {
    const features = getVisibleFeatures(); 
    if (features.length === 0) { alert("Brak punktów w zaznaczonym obszarze."); return; }
    const headers = ["numer_punktu", "x_pl2000", "y_pl2000", "h_evrf2007", "dx", "dy", "stan_znaku", "rodzaj_stabilizacji", "typ_znaku", "zrodlo_danych", "klasa_punktu"];
    let csvContent = "\uFEFF" + headers.join(";") + "\n";
    features.forEach(f => {
        const p = f.properties;
        const row = headers.map(header => { let val = p[header] !== undefined && p[header] !== null ? String(p[header]) : ""; val = val.replace(/"/g, '""'); if (val.search(/("|,|;|\n)/g) >= 0) val = `"${val}"`; return val; });
        csvContent += row.join(";") + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.setAttribute("href", url); link.setAttribute("download", "osnowa_agh_eksport.csv"); link.click();
    clearExportSelection();
}

function exportToGeoJson() {
    const features = getVisibleFeatures(); 
    if (features.length === 0) { alert("Brak punktów w zaznaczonym obszarze."); return; }
    const blob = new Blob([JSON.stringify({ type: "FeatureCollection", features: features }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.setAttribute("href", url); link.setAttribute("download", "osnowa_agh_eksport.geojson"); link.click();
    clearExportSelection();
}

if(floatExportCsv) floatExportCsv.addEventListener('click', exportToCsv);
if(floatExportGeoJson) floatExportGeoJson.addEventListener('click', exportToGeoJson);

const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportGeoJsonBtn = document.getElementById('exportGeoJsonBtn');
if(exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCsv);
if(exportGeoJsonBtn) exportGeoJsonBtn.addEventListener('click', exportToGeoJson);

// ==========================================
// OBSŁUGA INTERFEJSU MOBILNEGO
// ==========================================
const mobileBtn = document.getElementById('mobileLayersBtn');
const closeBtn = document.getElementById('closeLayersBtn');
const layersPanel = document.getElementById('layersPanel');

if (mobileBtn && closeBtn && layersPanel) {
    L.DomEvent.disableClickPropagation(mobileBtn);
    
    mobileBtn.addEventListener('click', function(e) {
        e.preventDefault();
        layersPanel.classList.add('mobile-active');
    });
    
    closeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        layersPanel.classList.remove('mobile-active');
    });
}

// Lista rozwijana dla wyszukiwarki (Podpowiedzi)
if (searchInput && customSuggestions) {
    searchInput.addEventListener('input', function() {
        const val = this.value.trim().toUpperCase();
        customSuggestions.innerHTML = '';
        
        if (!val) { 
            customSuggestions.style.display = 'none'; 
            return; 
        }
        
        const matches = Object.keys(pointsLayer).filter(nr => nr.includes(val)).slice(0, 6);
        
        if (matches.length > 0) {
            customSuggestions.style.display = 'block';
            matches.forEach(nr => {
                const li = document.createElement('li');
                li.textContent = nr;
                li.addEventListener('click', function() {
                    searchInput.value = nr;
                    customSuggestions.style.display = 'none';
                    searchPoint(); 
                });
                customSuggestions.appendChild(li);
            });
        } else {
            customSuggestions.style.display = 'none';
        }
    });

    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !customSuggestions.contains(e.target)) {
            customSuggestions.style.display = 'none';
        }
    });
}

initTutorial(map);