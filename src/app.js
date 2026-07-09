import L from 'leaflet';
window.L = L;
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import proj4 from 'proj4';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './style.css';

import { driver } from "driver.js";
import "driver.js/dist/driver.css";

import { osnowaData } from './dane.js';
import { zakresData } from './zakres.js';
import { wizuryData } from './wizury.js';

import { registerSW } from 'virtual:pwa-register';
import html2pdf from 'html2pdf.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

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

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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

function getPl2000Zone(lng) {
    if (lng < 16.5) return { epsg: 'EPSG:2176', zone: 5 };
    if (lng < 19.5) return { epsg: 'EPSG:2177', zone: 6 };
    if (lng < 22.5) return { epsg: 'EPSG:2178', zone: 7 };
    return { epsg: 'EPSG:2179', zone: 8 };
}

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
        measureBtn.style.backgroundColor = 'var(--accent-color)'; measureBtn.style.color = 'white';
        document.getElementById('map').style.cursor = 'crosshair'; measurePanel.style.display = 'block';
        map.on('click', handleMeasureClick);
    } else {
        measureBtn.style.backgroundColor = ''; measureBtn.style.color = 'var(--primary-color)';
        document.getElementById('map').style.cursor = ''; measurePanel.style.display = 'none';
        map.off('click', handleMeasureClick); clearMeasurement();
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
    
    const epsg = getPl2000Zone(measurePoints[0].lng).epsg;
    const ptsPl2000 = measurePoints.map(ll => proj4('EPSG:4326', epsg, [ll.lng, ll.lat]));
    let dist = 0;
    
    for (let i = 1; i < ptsPl2000.length; i++) {
		let dY = ptsPl2000[i][0] - ptsPl2000[i-1][0];
		let dX = ptsPl2000[i][1] - ptsPl2000[i-1][1];
		dist += Math.sqrt(dX*dX + dY*dY);
	}

	if (measureMode === 'area' && ptsPl2000.length > 2) {
		let dY = ptsPl2000[0][0] - ptsPl2000[ptsPl2000.length-1][0]; 
		let dX = ptsPl2000[0][1] - ptsPl2000[ptsPl2000.length-1][1]; 
		dist += Math.sqrt(dX*dX + dY*dY);
	}

    measureDist.innerText = dist > 1000 ? (dist / 1000).toFixed(3) + ' km' : dist.toFixed(2) + ' m';
    
    if (measureMode === 'area') {
        let area = 0;
        if (ptsPl2000.length > 2) {
            for (let i = 0; i < ptsPl2000.length; i++) {
                let j = (i + 1) % ptsPl2000.length;
                area += ptsPl2000[i][0] * ptsPl2000[j][1]; 
                area -= ptsPl2000[j][0] * ptsPl2000[i][1];
            }
            area = Math.abs(area) / 2;
        }
        measureArea.innerText = area > 10000 ? (area / 10000).toFixed(4) + ' ha' : area.toFixed(2) + ' m²';
    }
}

// ---------------------------------------------------------
// OSNOWA GEODEZYJNA I WIZUALIZACJA
// ---------------------------------------------------------

// Symbol - Osnowa Szczegółowa
function getOsnowaIcon(stan, nr) {
    let dotClass = 'dot-zniszczony';
    if (stan && stan.toLowerCase().includes('dobry')) dotClass = 'dot-dobry';
    else if (stan && stan.toLowerCase().includes('uszkodzony')) dotClass = 'dot-uszkodzony';
    
    const svgIcon = `
        <svg viewBox="0 0 100 100" class="osnowa-svg">
            <rect x="5" y="5" width="90" height="90" fill="#FFFF00" stroke="#000000" stroke-width="10"/>
            <line x1="27.5" y1="50" x2="72.5" y2="50" stroke="#000000" stroke-width="10" stroke-linecap="butt"/>
            <line x1="50" y1="27.5" x2="50" y2="72.5" stroke="#000000" stroke-width="10" stroke-linecap="butt"/>
        </svg>
    `;
    const labelHtml = nr ? `<div class="icon-nr-label">${nr}</div>` : '';
    return L.divIcon({ className: '', html: `<div class="custom-osnowa-icon">${svgIcon}<div class="status-dot ${dotClass}"></div>${labelHtml}</div>`, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14] });
}

// Symbol - Osnowa Pomiarowa
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
const warstwaKuzniar = L.markerClusterGroup(clusterOptions).addTo(map);
const warstwaStarzykiewicz = L.markerClusterGroup(clusterOptions).addTo(map);
const warstwaKryusCalka = L.markerClusterGroup(clusterOptions).addTo(map);
const wizuryDobreLayer = L.featureGroup();
const wizuryUtrudnioneLayer = L.featureGroup();
const zakresLayer = L.featureGroup();

// Funkcja obsługująca kliknięcie w klaster
function handleClusterClick(a) {
    a.layer.spiderfy();
}

// Przypięcie funkcji do warstw osnowy
warstwaPanstwowa.on('clusterclick', handleClusterClick);
warstwaSkulich.on('clusterclick', handleClusterClick);
warstwaKuzniar.on('clusterclick', handleClusterClick);
warstwaStarzykiewicz.on('clusterclick', handleClusterClick);
warstwaKryusCalka.on('clusterclick', handleClusterClick);

const allMarkersData = []; const pointsLayer = {};

// Funkcja dodająca i formatująca pojedynczy znacznik
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
    
    const isPomiarowa = (klasa_val.includes('pomiarowa') || zrodlo_val.includes('skulich'));
    const markerIcon = isPomiarowa ? getOsnowaPomiarowaIcon(stan_val, nr) : getOsnowaIcon(stan_val, nr);
    
    const marker = L.marker(latlng, { icon: markerIcon });
    pointsLayer[nr.toUpperCase()] = marker;

    let badgeClass = 'badge-zniszczony'; let stanWizualny = 'ZNISZCZONY';
    if (stan_val && stan_val.toLowerCase().includes('dobry')) { badgeClass = 'badge-dobry'; stanWizualny = 'ZACHOWANY'; } 
    else if (stan_val && stan_val.toLowerCase().includes('uszkodzony')) { badgeClass = 'badge-uszkodzony'; stanWizualny = 'USZKODZONY'; }

    const popLat = latlng[0]; const popLng = latlng[1];
    const wysokoscText = (!isNaN(h_val)) ? `${h_val.toFixed(3)} m` : 'Brak danych';

    let content = `
    <div class="popup-content">
        <div class="popup-header"><span>Punkt Osnowy ${nr}</span><span class="badge ${badgeClass}">${stanWizualny}</span></div>
        <div class="popup-body">
            <table class="popup-table">
                <tr><th>Typ znaku:</th><td>${escapeHTML(typ_znaku_val)}</td></tr>
                <tr><th>Rodzaj stabilizacji:</th><td>${escapeHTML(stabilizacja_val)}</td></tr>
                <tr><th>Wysokość H (PL-EVRF2007-NH):</th><td>${wysokoscText}</td></tr>
                <tr><th>X (PL-2000 strefa 7):</th><td>${x_val.toFixed(2)} m</td></tr>
                <tr><th>Y (PL-2000 strefa 7):</th><td>${y_val.toFixed(2)} m</td></tr>`;

    if ((stanWizualny === 'ZACHOWANY' || stanWizualny === 'USZKODZONY') && !isNaN(dx_val) && !isNaN(dy_val)) {
        content += `<tr><th>Błąd dX / dY:</th><td>${dx_val.toFixed(2)} / ${dy_val.toFixed(2)} m</td></tr>`;
    }
    
    content += `
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
				<div class="pdf-actions">
					<button class="action-btn btn-nav" onclick="generateReport('${nr}', ${popLng}, ${x_val}, ${y_val}, '${h_val}', '${escapeHTML(typ_znaku_val)}', '${escapeHTML(stabilizacja_val)}', '${stanWizualny}')" style="width: 100%; border:none; cursor:pointer;">Pobierz metryczkę (PDF)</button>
				</div>
			</div>
        </div>
    </div>`;
    
    marker.bindPopup(content);
    marker.feature = { type: "Feature", geometry: { type: "Point", coordinates: wgsCoords }, properties: row };

    let targetGroup = warstwaPanstwowa; 
    if (zrodlo_val.includes('skulich')) targetGroup = warstwaSkulich;
    else if (zrodlo_val.includes('kuzniar') || zrodlo_val.includes('kuźniar')) targetGroup = warstwaKuzniar;
    else if (zrodlo_val.includes('starzykiewicz')) targetGroup = warstwaStarzykiewicz;
    else if (zrodlo_val.includes('kryus') || zrodlo_val.includes('całka') || zrodlo_val.includes('calka')) targetGroup = warstwaKryusCalka;

    allMarkersData.push({ layer: marker, props: row, targetGroup: targetGroup, isLocal: fromLocalJS });
    targetGroup.addLayer(marker);
}

window.generateReport = function(nr, lng, x, y, h, typ, stab, stan) {
    const originalTitle = document.title;
    document.title = `Metryczka_Punktu_${nr}`;
    
    const zoneInfo = getPl2000Zone(lng);
    
    document.getElementById('reportNr').innerText = `Punkt nr: ${nr}`;
    document.getElementById('reportZone').innerText = zoneInfo.zone;
    document.getElementById('reportX').innerText = parseFloat(x).toFixed(2) + ' m';
    document.getElementById('reportY').innerText = parseFloat(y).toFixed(2) + ' m';
    document.getElementById('reportH').innerText = isNaN(parseFloat(h)) ? 'Brak danych' : parseFloat(h).toFixed(3) + ' m';
    document.getElementById('reportType').innerText = typ || '-';
    document.getElementById('reportStab').innerText = stab || '-';
    document.getElementById('reportStan').innerText = stan;
    document.getElementById('reportDate').innerText = new Date().toLocaleDateString('pl-PL');

    const imgElement = document.getElementById('reportSzkic');
    const reportElement = document.getElementById('printReport');
    
    imgElement.src = `szkice/${nr}.jpg`;
    
    const createPdf = () => {
    const options = {
        margin:       0,
        filename:     `Metryczka_Punktu_${nr}.pdf`,
        image:        { type: 'jpeg', quality: 1.0 },
        html2canvas:  { 
            scale: 2,
            useCORS: true,
            scrollY: 0
        },
        jsPDF:        { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait' 
        }
    };

    reportElement.style.display = 'flex';

    html2pdf().set(options).from(reportElement).save().then(() => {
        document.title = originalTitle;
        reportElement.style.display = 'none';
    });
};

    imgElement.onload = function() {
        createPdf();
    };
    
    imgElement.onerror = function() {
        imgElement.src = '';
        imgElement.alt = 'Brak szkicu topograficznego dla tego punktu w bazie.';
        createPdf();
    };
};

async function initData() {
    let successFromSupabase = false;

    // 1. Supabase
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

    // 2. Ładowanie lokalne
    if (!successFromSupabase) {
        if (typeof osnowaData !== 'undefined' && osnowaData.features) {
            osnowaData.features.forEach(f => {
                processMarkerData(f.properties, f.geometry.coordinates, true);
            });
        } else {
            console.error("Brak danych lokalnych osnowaData!");
        }
    }

    // 3. Ładowanie zakresu opracowania
    if (typeof zakresData !== 'undefined') {
        L.geoJSON(zakresData, { style: { color: "#a629c6", weight: 3, fillOpacity: 0.02 } }).addTo(zakresLayer);
        if (document.getElementById('layerZakres')?.checked) map.addLayer(zakresLayer);
    }
	
	// 4. Ładowanie wizur
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

    // 5. Dopasowanie widoku mapy do załadowanych punktów
    const allLayersArray = [warstwaPanstwowa, warstwaSkulich, warstwaKuzniar, warstwaStarzykiewicz, warstwaKryusCalka].filter(l => l.getLayers().length > 0);
    if (allLayersArray.length > 0) {
        map.fitBounds(L.featureGroup(allLayersArray).getBounds(), { padding: [40, 40] });
    }
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
toggleLayer('layerKuzniar', warstwaKuzniar);
toggleLayer('layerStarzykiewicz', warstwaStarzykiewicz);
toggleLayer('layerKryusCalka', warstwaKryusCalka);
toggleLayer('layerKieg', wmsKieg);
toggleLayer('layerAdresy', wmsAdresy);
toggleLayer('layerWizuryDobre', wizuryDobreLayer);
toggleLayer('layerWizuryUtrudnione', wizuryUtrudnioneLayer);
toggleLayer('layerZakres', zakresLayer);

const panelDiv = document.getElementById('layersPanel');
L.DomEvent.disableClickPropagation(panelDiv); L.DomEvent.disableScrollPropagation(panelDiv);

function searchPoint() {
    const inputRaw = document.getElementById('searchInput').value;
    const input = inputRaw.trim().toUpperCase();
    const errorMsg = document.getElementById('searchError');
    const targetLayer = pointsLayer[input];
    
    if (targetLayer) {
        errorMsg.style.display = 'none';
        if (warstwaPanstwowa.hasLayer(targetLayer) && !map.hasLayer(warstwaPanstwowa)) { map.addLayer(warstwaPanstwowa); document.getElementById('layerPanstwowa').checked = true; }
        if (warstwaSkulich.hasLayer(targetLayer) && !map.hasLayer(warstwaSkulich)) { map.addLayer(warstwaSkulich); document.getElementById('layerSkulich').checked = true; }
        if (warstwaKuzniar.hasLayer(targetLayer) && !map.hasLayer(warstwaKuzniar)) { map.addLayer(warstwaKuzniar); document.getElementById('layerKuzniar').checked = true; }
		if (warstwaStarzykiewicz.hasLayer(targetLayer) && !map.hasLayer(warstwaStarzykiewicz)) { map.addLayer(warstwaStarzykiewicz); document.getElementById('layerStarzykiewicz').checked = true; }
        if (warstwaKryusCalka.hasLayer(targetLayer) && !map.hasLayer(warstwaKryusCalka)) { map.addLayer(warstwaKryusCalka); document.getElementById('layerKryusCalka').checked = true; }
        map.setView(targetLayer.getLatLng(), 19, { animate: false });
        targetLayer.openPopup();
    } else if (input !== "") {
        errorMsg.innerText = "Nie znaleziono punktu: " + escapeHTML(inputRaw); errorMsg.style.display = 'block'; setTimeout(() => { errorMsg.style.display = 'none'; }, 3000);
    }
}

const filterDobry = document.getElementById('filterDobry');
const filterUszkodzony = document.getElementById('filterUszkodzony');
const filterZniszczony = document.getElementById('filterZniszczony');

function applyStateFilters() {
    warstwaPanstwowa.clearLayers();
    warstwaSkulich.clearLayers();
    warstwaKuzniar.clearLayers();
	warstwaStarzykiewicz.clearLayers();
    warstwaKryusCalka.clearLayers();

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
    cb.addEventListener('change', applyStateFilters);
});

document.getElementById('searchBtn').addEventListener('click', searchPoint);
document.getElementById("searchInput").addEventListener("keyup", function(e) { 
    if (e.key === "Enter") {
        searchPoint(); 
    }
});

let userLocationMarker = null;

document.getElementById('locateBtn').addEventListener('click', function() { 
    map.locate({setView: true, maxZoom: 17}); 
});

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

// LEGENDA
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
            <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><rect x="5" y="5" width="90" height="90" fill="#FFFF00" stroke="#000000" stroke-width="10"/><line x1="27.5" y1="50" x2="72.5" y2="50" stroke="#000000" stroke-width="10" stroke-linecap="butt"/><line x1="50" y1="27.5" x2="50" y2="72.5" stroke="#000000" stroke-width="10" stroke-linecap="butt"/></svg>Osnowa Szczegółowa Pozioma</div>
            <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg" style="border-radius:50%;"><circle cx="50" cy="65" r="30" fill="transparent" stroke="#000000" stroke-width="8"/><line x1="50" y1="35" x2="50" y2="5" stroke="#000000" stroke-width="8" stroke-linecap="round"/></svg>Osnowa Pomiarowa</div>
            
            <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><rect x="5" y="5" width="90" height="90" fill="transparent" stroke="#a629c6" stroke-width="15"/></svg>Zakres opracowania</div>
            
			<div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><line x1="0" y1="50" x2="100" y2="50" stroke="#ef4444" stroke-width="12"/></svg>Wizury dobre</div>
			<div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><line x1="0" y1="50" x2="100" y2="50" stroke="#ef4444" stroke-width="12" stroke-dasharray="20, 20"/></svg>Wizury utrudnione</div>
			
            <div style="margin-top: 10px;"></div>
            <div class="legend-item"><div class="status-dot dot-dobry" style="position:relative; margin-right:12px; margin-left:4px;"></div>Punkty Zachowane</div>
            <div class="legend-item"><div class="status-dot dot-uszkodzony" style="position:relative; margin-right:12px; margin-left:4px;"></div>Punkty Uszkodzone</div>
            <div class="legend-item"><div class="status-dot dot-zniszczony" style="position:relative; margin-right:12px; margin-left:4px;"></div>Punkty Zniszczone</div>
            <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 9px; font-weight: 700; color: #6b7280; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">Stan danych na: 18.04.2026 r.</div>
        </div>
    `;
    return div;
};
legend.addTo(map);

// Logika zwijania/rozwijania
const legendHeader = document.getElementById('legend-header');
const legendContent = document.getElementById('legend-content');
const legendIcon = document.getElementById('legend-icon');

const isMobile = window.innerWidth <= 768;

function toggleLegend(forceClose = false) {
    if (legendContent.style.display === 'none' && !forceClose) {
        legendContent.style.display = 'block';
        legendIcon.style.transform = 'rotate(180deg)';
    } else {
        legendContent.style.display = 'none';
        legendIcon.style.transform = 'rotate(0deg)';
    }
}

// Obsługa kliknięcia
legendHeader.addEventListener('click', () => toggleLegend());

// Inicjalizacja przy ładowaniu
if (isMobile) {
    toggleLegend(true);
} else {
    legendIcon.style.transform = 'rotate(180deg)';
}

map.fire('zoomend');

// --- EKSPORT DANYCH ---
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

// Inicjacja rysowania po kliknięciu w "Wybierz obszar" w menu warstw
selectAreaBtn.addEventListener('click', () => {
    const layersPanel = document.getElementById('layersPanel');
    if (layersPanel) layersPanel.classList.remove('mobile-active');

    isDrawingExportBox = true;
    selectionStartPoint = null;
    document.getElementById('map').style.cursor = 'crosshair';
    
    exportFloatingPanel.style.display = 'flex';
    exportActionButtons.style.display = 'none';
    exportInstructions.innerText = "Kliknij w pierwszy róg obszaru na mapie...";
});

// Obsługa kliknięć na mapie
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
        exportInstructions.innerText = "Teraz kliknij w drugi (przeciwległy) róg.";
    } else {
        exportSelectionBox.setBounds([selectionStartPoint, e.latlng]);
        exportSelectionBounds = exportSelectionBox.getBounds(); 
        isDrawingExportBox = false; 
        document.getElementById('map').style.cursor = '';
        
        exportInstructions.innerText = "Obszar zaznaczony. Wybierz format zapisu:";
        exportActionButtons.style.display = 'flex';
    }
});

// Wizualizacja prostokąta na żywo przy ruchu myszką
map.on('mousemove', function(e) {
    if (isDrawingExportBox && selectionStartPoint && exportSelectionBox) {
        exportSelectionBox.setBounds([selectionStartPoint, e.latlng]);
    }
});

// Resetowanie i czyszczenie
function clearExportSelection() { 
    isDrawingExportBox = false; 
    selectionStartPoint = null; 
    document.getElementById('map').style.cursor = ''; 
    exportFloatingPanel.style.display = 'none';
    if (exportSelectionBox) { 
        map.removeLayer(exportSelectionBox); 
        exportSelectionBox = null; 
        exportSelectionBounds = null; 
    } 
}
floatExportCancel.addEventListener('click', clearExportSelection);

function getVisibleFeatures() {
    let features = []; 
    const activeGroups = [ 
        { layer: warstwaPanstwowa, checkboxId: 'layerPanstwowa' }, 
        { layer: warstwaSkulich, checkboxId: 'layerSkulich' }, 
        { layer: warstwaKuzniar, checkboxId: 'layerKuzniar' },
        // DODANE DO EKSPORTU
        { layer: warstwaStarzykiewicz, checkboxId: 'layerStarzykiewicz' },
        { layer: warstwaKryusCalka, checkboxId: 'layerKryusCalka' }
    ];
    activeGroups.forEach(group => {
        if (document.getElementById(group.checkboxId).checked) {
            group.layer.eachLayer(marker => {
                if (marker.feature) {
                    if (exportSelectionBounds) { if (exportSelectionBounds.contains(marker.getLatLng())) features.push(marker.feature); } 
                    else features.push(marker.feature);
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

floatExportCsv.addEventListener('click', exportToCsv);
floatExportGeoJson.addEventListener('click', exportToGeoJson);

const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportGeoJsonBtn = document.getElementById('exportGeoJsonBtn');
if(exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCsv);
if(exportGeoJsonBtn) exportGeoJsonBtn.addEventListener('click', exportToGeoJson);


// --- OBSŁUGA INTERFEJSU MOBILNEGO ---

// Panel warstw
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

// Lista rozwijana dla wyszukiwarki
const searchInputElem = document.getElementById('searchInput');
const customSuggestions = document.getElementById('customSuggestions');

if (searchInputElem && customSuggestions) {
    searchInputElem.addEventListener('input', function() {
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
                    searchInputElem.value = nr;
                    customSuggestions.style.display = 'none';
                    searchPoint(); 
                });
                customSuggestions.appendChild(li);
            });
        } else {
            customSuggestions.style.display = 'none';
        }
    });

    // Ukrywanie listy po kliknięciu na mapę
    document.addEventListener('click', function(e) {
        if (!searchInputElem.contains(e.target) && !customSuggestions.contains(e.target)) {
            customSuggestions.style.display = 'none';
        }
    });
}

// --- OBSŁUGA EKRANU POWITALNEGO ---
document.addEventListener('DOMContentLoaded', () => {
    const welcomeModal = document.getElementById('welcomeModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const startTutorialFromModalBtn = document.getElementById('startTutorialFromModalBtn');
    
    if (!sessionStorage.getItem('welcomeModalSeen')) {
        welcomeModal.style.display = 'flex';
    }

    closeModalBtn.addEventListener('click', () => {
        welcomeModal.style.display = 'none';
        sessionStorage.setItem('welcomeModalSeen', 'true');
    });

    if (startTutorialFromModalBtn) {
        startTutorialFromModalBtn.addEventListener('click', () => {
            welcomeModal.style.display = 'none';
            sessionStorage.setItem('welcomeModalSeen', 'true');
            startTutorial();
        });
    }
});

const faqModal = document.getElementById('faqModal');
const faqBtn = document.getElementById('faqBtn');
const closeFaqBtn = document.getElementById('closeFaqBtn');
const closeFaqIcon = document.getElementById('closeFaqIcon');

L.DomEvent.disableClickPropagation(faqBtn);

faqBtn.addEventListener('click', () => {
    faqModal.style.display = 'flex';
});

closeFaqBtn.addEventListener('click', () => {
    faqModal.style.display = 'none';
});

if (closeFaqIcon) {
    closeFaqIcon.addEventListener('click', () => {
        faqModal.style.display = 'none';
    });
}

faqModal.addEventListener('click', (e) => {
    if (e.target === faqModal) {
        faqModal.style.display = 'none';
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && faqModal.style.display === 'flex') {
        faqModal.style.display = 'none';
    }
});

// --- OBSŁUGA ZGŁASZANIA BŁĘDÓW ---
const bugModal = document.getElementById('bugModal');
const bugBtn = document.getElementById('bugBtn');
const closeBugIcon = document.getElementById('closeBugIcon');
const sendBugBtn = document.getElementById('sendBugBtn');

if (bugBtn) L.DomEvent.disableClickPropagation(bugBtn);

bugBtn.addEventListener('click', () => {
    bugModal.style.display = 'flex';
});

closeBugIcon.addEventListener('click', () => {
    bugModal.style.display = 'none';
});

bugModal.addEventListener('click', (e) => {
    if (e.target === bugModal) bugModal.style.display = 'none';
});

sendBugBtn.addEventListener('click', () => {
    const desc = document.getElementById('bugDescription').value;
    
    if (desc.trim() !== "") {
        setTimeout(() => {
            bugModal.style.display = 'none';
            document.getElementById('bugDescription').value = '';
            document.getElementById('bugReporter').value = '';
        }, 500);
    }
});

// --- SAMOUCZEK (DRIVER.JS) ---
const tutorialBtn = document.getElementById('tutorialBtn');

if (tutorialBtn) {
    L.DomEvent.disableClickPropagation(tutorialBtn);
}

// 1. Wspólna konfiguracja
const driverConfig = {
    showProgress: true,
    nextBtnText: 'Dalej ➔',
    prevBtnText: '🠔 Wstecz',
    doneBtnText: 'Zakończ',
    popoverClass: 'custom-driver-popover',
    allowClose: true
};

// 2. Rozbudowana ścieżka dla ekranów komputerów
const desktopSteps = [
    { 
        popover: { 
            title: 'Witaj w aplikacji!', 
            description: 'Ten przewodnik pokaże Ci, jak korzystać z narzędzi tutaj dostępnych. Kliknij "Dalej".' 
        } 
    },
    { 
        element: '.search-container', 
        popover: { 
            title: 'Wyszukiwanie', 
            description: 'Wpisz numer szukanego punktu (np. "16090"). System przefiltruje bazę, a po zatwierdzeniu wyśrodkuje mapę i wyświetli kartę informacyjną z danymi opisowymi.', 
            side: "bottom", 
            align: 'start' 
        } 
    },
	{ 
        element: '.leaflet-popup', 
        popover: { 
            title: 'Karta informacyjna punktu', 
            description: 'Przeanalizujmy atrybuty na przykładzie punktu 712511112230. Znajdziesz tu m.in. typ znaku (rurka hartowana), rodzaj stabilizacji (Naziemny), wysokość, współrzędne oraz klasę osnowy.', 
            side: "left", 
            align: 'start' 
        },
        onHighlightStarted: () => {
            document.getElementById('searchInput').value = '712511112230';
            searchPoint();
        }
    },
    { 
        element: '.topo-section:nth-of-type(1)', 
        popover: { 
            title: 'Opis topograficzny', 
            description: 'Tutaj możesz wyświetlić (lub pobrać) opis topograficzny w formacie PDF oraz JPG.', 
            side: "top" 
        },
        onHighlightStarted: () => {
            const popupBody = document.querySelector('.popup-body');
            const target = document.querySelectorAll('.topo-section')[0];
            if (popupBody && target) popupBody.scrollTop = target.offsetTop - 20;
        }
    },
    { 
        element: '.topo-section:nth-of-type(2)', 
        popover: { 
            title: 'Mapa porównania z terenem', 
            description: 'Narzędzie pozwala wyświetlić plik PDF z mapą porównania z terenem.', 
            side: "top" 
        },
        onHighlightStarted: () => {
            const popupBody = document.querySelector('.popup-body');
            const target = document.querySelectorAll('.topo-section')[1];
            if (popupBody && target) popupBody.scrollTop = target.offsetTop - 20;
        }
    },
    { 
        element: '.topo-section:nth-of-type(3)', 
        popover: { 
            title: 'Nawigacja do punktu', 
            description: 'Opcja wyjątkowo przydatna w terenie. Jednym kliknięciem uruchomisz trasę w aplikacjach Google Maps lub Apple Maps prosto do lokalizacji znaku.', 
            side: "top" 
        },
        onHighlightStarted: () => {
            const popupBody = document.querySelector('.popup-body');
            const target = document.querySelectorAll('.topo-section')[2];
            if (popupBody && target) popupBody.scrollTop = target.offsetTop - 20;
        }
    },
	{ 
        element: '.section-raport', 
        popover: { 
            title: 'Metryczka punktu', 
            description: 'Funkcja ta pozwala na wygenerowanie automatycznego raportu odnośnie punktu osnowy w formacie PDF. Dane w raporcie tworzone są na podstawie danych opisowych znaku oraz opisu topograficznego.', 
            side: "top",
            align: 'start'
        },
        onHighlightStarted: () => {
            const target = document.querySelector('.section-raport');
            if (target) target.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
    },
    { 
        element: '#locateBtn', 
        popover: { 
            title: 'Lokalizacja urządzenia',
            description: 'Po kliknięciu danej opcji, aplikacja automatycznie wskaże oraz przeniesie Cię w Twoje aktualne położenie.', 
            side: "right" 
        } 
    },
    { 
        element: '#measureBtn', 
        popover: { 
            title: 'Pomiary', 
            description: 'Narzędzie umożliwiające pomiar odległości oraz pola powierzchni.', 
            side: "right" 
        } 
    },
    { 
        element: '#layersPanel', 
        popover: { 
            title: 'Zarządzanie widokiem mapy oraz prezentacji danych', 
            description: 'Umożliwia przełączanie podkładów mapowych, uruchamianie usług WMS i innych warstw.', 
            side: "left" 
        } 
    },
    { 
        element: '#selectAreaBtn', 
        popover: { 
            title: 'Eksport danych', 
            description: 'Narzędzie do pobierania danych. Zaznacz na mapie prostokąt, z którego chcesz wyeksportować wybrane punkty do formatu CSV lub GeoJSON.', 
            side: "left" 
        },
        onHighlightStarted: () => {
            const btn = document.getElementById('selectAreaBtn');
            const accordionContent = btn.closest('.accordion-content');
            const accordionHeader = accordionContent.previousElementSibling;
            if (accordionContent.style.display !== "block") {
                accordionContent.style.display = "block";
                accordionHeader.classList.add('active');
            }
            document.querySelector('.layers-body').scrollTop = 1000;
        }
    },
    { 
        element: '.info.legend', 
        popover: { 
            title: 'Legenda', 
            description: 'Zwijana legenda objaśniająca dane prezentowane na mapie.', 
            side: "top" 
        } 
    },
    { 
        element: '#coordinatesPanel', 
        popover: { 
            title: 'Transformacja', 
            description: 'Panel wyświetlający aktualne współrzędne w układzie globalnym WGS84 oraz ich przelicznik na obowiązujący układ PL-2000.', 
            side: "top" 
        } 
    },
    { 
        element: '#faqBtn', 
        popover: { 
            title: 'Instrukcja obsługi', 
            description: 'Jeśli zapomnisz do czego służą poszczególne narzędzia, tutaj odnajdziesz najczęściej zadawane pytania.', 
            side: "right" 
        } 
    },
	{ 
        element: '#tutorialBtn', 
        popover: { 
            title: 'Samouczek', 
            description: 'Ponowne uruchomienie samouczka obsługi aplikacji. Jeżeli chcesz w szybki sposób przypomnieć sobie wiedzę odnośnie obsługi aplikacji, możesz ponownie włączyć przygotowany przez nas tutorial.', 
            side: "right" 
        } 
    },
    { 
        element: '#bugBtn', 
        popover: { 
            title: 'Zgłaszanie błędów', 
            description: 'Napotkałeś problem? Skorzystaj z tego przycisku, aby wysłać zgłoszenie bezpośrednio do nas.', 
            side: "right" 
        } 
    },
	{
        popover: {
            title: 'Koniec samouczka',
            description: `To już wszystko, życzymy przyjemnego korzystania z aplikacji. W razie problemów panel pomocy jest do Twojej dyspozycji. Powodzenia!
            <div style="text-align: center; margin-top: 25px;">
                <img src="https://upload.wikimedia.org/wikipedia/commons/3/35/Znak_graficzny_AGH.svg" alt="Logo AGH" style="width: 50px; margin-bottom: 10px;">
                <div style="font-size: 9px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                    Stan danych na: 18.04.2026 r.
                </div>
            </div>`
        }
    }
];

// 3. Ścieżka zoptymalizowana dla urządzeń mobilnych (w terenie)
const mobileSteps = [
    { 
        popover: { 
            title: 'Witaj w aplikacji!', 
            description: 'Ten przewodnik pokaże Ci, jak korzystać z narzędzi tutaj dostępnych. Zobaczmy, jak to działa.' 
        } 
    },
    { 
        element: '.search-container', 
        popover: { 
            title: 'Wyszukiwanie', 
            description: 'Wpisz fragment numeru punktu. Lista podpowiedzi pozwoli Ci szybko go odnaleźć i przybliżyć do niego mapę.', 
            side: "bottom", 
            align: 'start' 
        } 
    },
    { 
        element: '#locateBtn', 
        popover: { 
            title: 'Nawigacja', 
            description: 'Najważniejsze narzędzie w terenie. Kliknij, by wyśrodkować mapę na module GPS Twojego smartfona.', 
            side: "right" 
        } 
    },
    { 
        element: '.leaflet-popup', 
        popover: { 
            title: 'Karta informacyjna punktu', 
            description: 'Przeanalizujmy atrybuty na przykładzie punktu 712511112230. Znajdziesz tu m.in. typ znaku (rurka hartowana), rodzaj stabilizacji (Naziemny), wysokość, współrzędne oraz klasę osnowy.', 
            side: "bottom", 
            align: 'start' 
        },
        onHighlightStarted: () => {
            document.getElementById('searchInput').value = '712511112230';
            searchPoint();
        }
    },
    { 
        element: '.topo-section:nth-of-type(1)', 
        popover: { 
            title: 'Opis topograficzny', 
            description: 'Tutaj możesz wyświetlić (lub pobrać) opis topograficzny w formacie PDF oraz JPG.', 
            side: "top" 
        },
        onHighlightStarted: () => {
            const popupBody = document.querySelector('.popup-body');
            const target = document.querySelectorAll('.topo-section')[0];
            if (popupBody && target) popupBody.scrollTop = target.offsetTop - 20;
        }
    },
    { 
        element: '.topo-section:nth-of-type(2)', 
        popover: { 
            title: 'Mapa porównania z terenem', 
            description: 'Narzędzie pozwala wyświetlić plik PDF z mapą porównania z terenem.', 
            side: "top" 
        },
        onHighlightStarted: () => {
            const popupBody = document.querySelector('.popup-body');
            const target = document.querySelectorAll('.topo-section')[1];
            if (popupBody && target) popupBody.scrollTop = target.offsetTop - 20;
        }
    },
    { 
        element: '.topo-section:nth-of-type(3)', 
        popover: { 
            title: 'Nawigacja do punktu', 
            description: 'Opcja wyjątkowo przydatna w terenie. Jednym kliknięciem uruchomisz trasę w aplikacjach Google Maps lub Apple Maps prosto do lokalizacji znaku.', 
            side: "top" 
        },
        onHighlightStarted: () => {
            const popupBody = document.querySelector('.popup-body');
            const target = document.querySelectorAll('.topo-section')[2];
            if (popupBody && target) popupBody.scrollTop = target.offsetTop - 20;
        }
    },
	{ 
        element: '.section-raport', 
        popover: { 
            title: 'Metryczka punktu', 
            description: 'Funkcja ta pozwala na wygenerowanie automatycznego raportu odnośnie punktu osnowy w formacie PDF. Dane w raporcie tworzone są na podstawie danych opisowych znaku oraz opisu topograficznego.', 
            side: "top",
            align: 'start'
        },
        onHighlightStarted: () => {
            const target = document.querySelector('.section-raport');
            if (target) target.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
    },
    { 
        element: '#mobileLayersBtn', 
        popover: { 
            title: 'Panel Warstw', 
            description: 'Otwórz panel, aby zarządzać podkładami mapowymi lub przygotować dane do eksportu.', 
            side: "right" 
        },
        onHighlightStarted: () => {
            map.closePopup();
            document.getElementById('layersPanel').classList.remove('mobile-active');
        }
    },
    { 
        element: '#selectAreaBtn', 
        popover: { 
            title: 'Eksport danych', 
            description: 'Zaznacz na mapie interesujący Cię obszar, a następnie pobierz dane punktów do pliku CSV lub GeoJSON.', 
            side: "top" 
        },
        onHighlightStarted: () => {
            document.getElementById('layersPanel').classList.add('mobile-active');
            
            const btn = document.getElementById('selectAreaBtn');
            if (btn) {
                const content = btn.closest('.accordion-content');
                if (content) {
                    content.style.display = 'block';
                    if (content.previousElementSibling) content.previousElementSibling.classList.add('active');
                }
                const layersBody = document.querySelector('.layers-body');
                if (layersBody) layersBody.scrollTo({ top: btn.offsetTop - 60, behavior: 'smooth' });
            }
        }
    },
    { 
        element: '#measureBtn', 
        popover: { 
            title: 'Pomiary', 
            description: 'Uruchamia narzędzie pomiarowe pozwalające na wyznaczenie odległości i pola powierzchni.', 
            side: "right" 
        },
        onHighlightStarted: () => {
            document.getElementById('layersPanel').classList.remove('mobile-active');
        }
    },
    { 
        element: '.info.legend', 
        popover: { 
            title: 'Legenda', 
            description: 'Dotknij nagłówka legendy, aby ją rozwinąć.', 
            side: "top" 
        } 
    },
    { 
        element: '#faqBtn', 
        popover: { 
            title: 'Pomoc', 
            description: 'Skrócona instrukcja obsługi narzędzi aplikacji jest dostępna zawsze pod tym przyciskiem.', 
            side: "right" 
        } 
    },
	{ 
        element: '#tutorialBtn', 
        popover: { 
            title: 'Samouczek', 
            description: 'Ponowne uruchomienie samouczka obsługi aplikacji. Jeżeli chcesz w szybki sposób przypomnieć sobie wiedzę odnośnie obsługi aplikacji, możesz ponownie włączyć przygotowany przez nas tutorial.', 
            side: "right" 
        } 
    },
    { 
        element: '#bugBtn', 
        popover: { 
            title: 'Zgłaszanie błędów', 
            description: 'Napotkałeś problem? Skorzystaj z tego przycisku, aby wysłać zgłoszenie bezpośrednio do nas.', 
            side: "right" 
        } 
    },
	{
        popover: {
            title: 'Koniec samouczka',
            description: `To już wszystko, życzymy przyjemnego korzystania z aplikacji. W razie problemów panel pomocy jest do Twojej dyspozycji. Powodzenia!
            <div style="text-align: center; margin-top: 25px;">
                <img src="https://upload.wikimedia.org/wikipedia/commons/3/35/Znak_graficzny_AGH.svg" alt="Logo AGH" style="width: 50px; margin-bottom: 10px;">
                <div style="font-size: 9px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                    Stan danych na: 18.04.2026 r.
                </div>
            </div>`
        }
    }
];

// 4. Inicjalizacja poprzez wydzieloną funkcję
function startTutorial() {
    const isMobileView = window.innerWidth <= 768;
    
    const initialCenter = map.getCenter();
    const initialZoom = map.getZoom();
    
    const driverObj = driver({
        ...driverConfig,
        steps: isMobileView ? mobileSteps : desktopSteps,
        
        onDestroyed: () => {
            map.closePopup();
            map.setView(initialCenter, initialZoom);
            document.getElementById('searchInput').value = '';
        }
    });
    
    driverObj.drive();
}


if (tutorialBtn) {
    tutorialBtn.addEventListener('click', startTutorial);
}

// Inicjalizacja PWA
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('Dostępna nowa wersja aplikacji. Odśwież stronę.');
  },
  onOfflineReady() {
    console.log('Aplikacja jest gotowa do pracy offline w terenie.');
  },
});