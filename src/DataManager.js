// DataManager.js

import L from 'leaflet';
import proj4 from 'proj4';
import { IconManager } from './IconManager.js';
import { showLoader, hideLoader, escapeHTML } from './utils.js';
import { generateReport } from './pdfReport.js';
import { osnowaData } from './dane.js';
import { zakresData } from './zakres.js';
import { wizuryData } from './wizury.js';
import { STAN_ZNAKU, STAN_WIZUALNY, KLASA_OSNOWY, ZRODLO_DANYCH } from './constants.js';
import { t, tv, updateDOMTranslations } from './i18n.js';

export class DataManager {
    constructor(map, supabaseUrl, supabaseKey) {
        this.map = map;
        this.supabaseUrl = supabaseUrl;
        this.supabaseKey = supabaseKey;
        
        this.allMarkersData = [];
        this.pointsLayer = {};

        this.initClusters();
        this.initGeoJsonLayers();
        this.initLayerToggles();
        this.initFilters();
        this.initSearch();
        this.initLegend();
    }

    initClusters() {
        const clusterOptions = { 
            disableClusteringAtZoom: 16, 
            spiderfyOnMaxZoom: true, 
            showCoverageOnHover: false,
            zoomToBoundsOnClick: false
        };

        this.layers = {
            fundamentalna: L.markerClusterGroup(clusterOptions),
            bazowa: L.markerClusterGroup(clusterOptions),
            szczegolowaPanstwowa: L.markerClusterGroup(clusterOptions),
            szczegolowaInne: L.markerClusterGroup(clusterOptions),
            wysokosciowaPanstwowa: L.markerClusterGroup(clusterOptions),
            wysokosciowaInne: L.markerClusterGroup(clusterOptions),
            pomiarowaInne: L.markerClusterGroup(clusterOptions)
        };

        Object.values(this.layers).forEach(layer => {
            layer.addTo(this.map);
            layer.on('clusterclick', a => a.layer.spiderfy());
        });
    }

    async initData() {
        showLoader(t('loading_points'));
        let successFromSupabase = false;

        try {
            let allData = [];
            let offset = 0;
            const limit = 1000;
            let fetchMore = true;

            while (fetchMore) {
                const response = await fetch(`${this.supabaseUrl}/rest/v1/osnowa?select=*&limit=${limit}&offset=${offset}`, {
                    headers: { 'apikey': this.supabaseKey, 'Authorization': `Bearer ${this.supabaseKey}` }
                });
                
                if (!response.ok) throw new Error("Błąd pobierania");
                
                const data = await response.json();
                
                if (data && data.length > 0) {
                    allData.push(...data);
                    offset += limit;
                    if (data.length < limit) fetchMore = false;
                } else {
                    fetchMore = false;
                }
            }
            
            if (allData.length > 0) {
                allData.forEach(row => {
                    const x = parseFloat(row.y_pl2000);
                    const y = parseFloat(row.x_pl2000);
                    if (isNaN(x) || isNaN(y)) return;
                    
                    const wgsCoords = proj4('EPSG:2178', 'EPSG:4326', [x, y]);
                    this.processMarkerData(row, wgsCoords, false);
                });
                successFromSupabase = true;
            }
        } catch (e) { 
            console.warn("Supabase niedostępne, używam danych lokalnych."); 
        }

        if (!successFromSupabase && typeof osnowaData !== 'undefined' && osnowaData.features) {
            osnowaData.features.forEach(f => {
                this.processMarkerData(f.properties, f.geometry.coordinates, true);
            });
        }

        const markersToAdd = new Map();
        Object.values(this.layers).forEach(layer => markersToAdd.set(layer, []));
        
        this.allMarkersData.forEach(item => {
            markersToAdd.get(item.targetGroup).push(item.layer);
        });

        for (let [group, markers] of markersToAdd) {
            if (markers.length > 0) group.addLayers(markers);
        }

        this.fitMapToBounds();
        hideLoader();

        setTimeout(() => {
            const urlParams = new URLSearchParams(window.location.search);
            const pointId = urlParams.get('id');
            if (pointId && window.searchPoint) {
                window.searchPoint(pointId);
            }
        }, 500);
    }

    processMarkerData(row, wgsCoords, fromLocalJS) {
        const latlng = [wgsCoords[1], wgsCoords[0]];
        const nr = String(row.numer_punktu || row.Nr || t('no_data')).trim();
        const x_val = parseFloat(row.x_pl2000 || row.X);
        const y_val = parseFloat(row.y_pl2000 || row.Y);
        const h_val = parseFloat(row.h_evrf2007 || row.H);
        const dx_val = parseFloat(row.dx || row.dX);
        const dy_val = parseFloat(row.dy || row.dY);
        const stan_val = String(row.stan_znaku || row.stan || '');
        const zrodlo_val = String(row.zrodlo_danych || row.uwagi || '').toLowerCase();
        const klasa_val = String(row.klasa_punktu || '').toLowerCase();
        const stabilizacja_val = String(row.rodzaj_stabilizacji || row.notatka || '');
        const typ_znaku_val = String(row.typ_znaku || '');
        
        let targetGroup, isPanstwowa = true, iconType = 'szczegolowa';

        if (klasa_val.includes(KLASA_OSNOWY.FUNDAMENTALNA)) {
            targetGroup = this.layers.fundamentalna; iconType = 'fundamentalna';
        } else if (klasa_val.includes(KLASA_OSNOWY.BAZOWA)) {
            targetGroup = this.layers.bazowa; iconType = 'bazowa';
        } else if (klasa_val.includes(KLASA_OSNOWY.WYSOKOSCIOWA) || klasa_val.includes(KLASA_OSNOWY.WYSOKOSCIOWA_BEZ_ZNAKU)) {
            isPanstwowa = !(zrodlo_val.includes(ZRODLO_DANYCH.SKULICH) || zrodlo_val.includes(ZRODLO_DANYCH.KUZNIAR) || zrodlo_val.includes(ZRODLO_DANYCH.UCZELNIA));
            targetGroup = isPanstwowa ? this.layers.wysokosciowaPanstwowa : this.layers.wysokosciowaInne;
            iconType = 'wysokosciowa';
        } else if (klasa_val.includes(KLASA_OSNOWY.POMIAROWA) || zrodlo_val.includes(ZRODLO_DANYCH.KRYUS) || zrodlo_val.includes(ZRODLO_DANYCH.CALKA)) {
            isPanstwowa = false; iconType = 'pomiarowa';
            targetGroup = this.layers.pomiarowaInne;
        } else {
            const isOther = zrodlo_val.includes(ZRODLO_DANYCH.SKULICH) || zrodlo_val.includes(ZRODLO_DANYCH.KUZNIAR) || zrodlo_val.includes(ZRODLO_DANYCH.STARZYKIEWICZ);
            isPanstwowa = !isOther; 
            targetGroup = isPanstwowa ? this.layers.szczegolowaPanstwowa : this.layers.szczegolowaInne;
            iconType = 'szczegolowa';
        }

        const markerIcon = IconManager.getIcon(iconType, stan_val, nr, isPanstwowa);
        const marker = L.marker(latlng, { icon: markerIcon });
        
        this.pointsLayer[nr.toUpperCase()] = marker;

        marker.on('click', () => {
            const popupContent = this.generatePopupHTML(row, latlng, nr, x_val, y_val, h_val, dx_val, dy_val, stan_val, zrodlo_val, klasa_val, stabilizacja_val, typ_znaku_val);
            const popupWrapper = document.createElement('div');
            popupWrapper.innerHTML = popupContent;
            
            const reportBtn = document.createElement('button');
            reportBtn.className = 'action-btn btn-nav';
            reportBtn.style.cssText = 'width: 100%; border:none; cursor:pointer;';
            reportBtn.innerText = t('download_report');
            
            let stanKlucz = stan_val.toLowerCase().includes(STAN_ZNAKU.DOBRY) ? 'stat_good' : 
                            (stan_val.toLowerCase().includes(STAN_ZNAKU.USZKODZONY) ? 'stat_dmg' : 'stat_dest');
            
            reportBtn.addEventListener('click', () => generateReport(nr, latlng[1], x_val, y_val, h_val, typ_znaku_val, stabilizacja_val, stanKlucz, klasa_val));
            popupWrapper.querySelector('#report-btn-container').appendChild(reportBtn);

            L.popup().setLatLng(latlng).setContent(popupWrapper).openOn(this.map);
        });

        marker.feature = { type: "Feature", geometry: { type: "Point", coordinates: wgsCoords }, properties: row };

        this.allMarkersData.push({ layer: marker, props: row, targetGroup: targetGroup, isLocal: fromLocalJS });
    }

    generatePopupHTML(row, latlng, nr, x_val, y_val, h_val, dx_val, dy_val, stan_val, zrodlo_val, klasa_val, stabilizacja_val, typ_znaku_val) {
        let badgeClass = stan_val.toLowerCase().includes(STAN_ZNAKU.DOBRY) ? 'badge-dobry' : 
                         (stan_val.toLowerCase().includes(STAN_ZNAKU.USZKODZONY) ? 'badge-uszkodzony' : 'badge-zniszczony');
        
        let stanWizualny = stan_val.toLowerCase().includes(STAN_ZNAKU.DOBRY) ? 'stat_good' : 
                           (stan_val.toLowerCase().includes(STAN_ZNAKU.USZKODZONY) ? 'stat_dmg' : 'stat_dest');
        
        const isPodstawowa = klasa_val.includes(KLASA_OSNOWY.FUNDAMENTALNA) || klasa_val.includes(KLASA_OSNOWY.BAZOWA);
        const precisionXY = 2, precisionH = isPodstawowa ? 4 : 3;

        return `
        <div class="popup-content">
            <div class="popup-header"><span>${t('point_label')} ${nr}</span><span class="badge ${badgeClass}">${t(stanWizualny).toUpperCase()}</span></div>
            <div class="popup-body">
                <table class="popup-table">
                    <tr><th>${t('point_type')}</th><td>${escapeHTML(tv(typ_znaku_val))}</td></tr>
                    <tr><th>${t('stabilization')}</th><td>${escapeHTML(tv(stabilizacja_val))}</td></tr>
                    <tr><th>${t('height')}</th><td>${!isNaN(h_val) ? h_val.toFixed(precisionH) + ' m' : t('no_data')}</td></tr>
                    <tr><th>X (PL-2000):</th><td>${!isNaN(x_val) ? x_val.toFixed(precisionXY) + ' m' : t('no_data')}</td></tr>
                    <tr><th>Y (PL-2000):</th><td>${!isNaN(y_val) ? y_val.toFixed(precisionXY) + ' m' : t('no_data')}</td></tr>
                    ${(stanWizualny !== 'stat_dest' && !isNaN(dx_val)) ? `<tr><th>${t('error_xy')}</th><td>${dx_val.toFixed(2)} / ${dy_val.toFixed(2)} m</td></tr>` : ''}
                    <tr><th>${t('class')}</th><td>${escapeHTML(tv(klasa_val) || tv('szczegółowa'))}</td></tr>
                    <tr><th>${t('data_source')}</th><td>${escapeHTML(tv(row.zrodlo_danych || row.uwagi || ''))}</td></tr>
                </table>
                <div class="topo-section"><div class="topo-title">${t('topo_desc')}</div>
                    <div class="pdf-actions"><a href="szkice/${nr}.pdf" target="_blank" class="action-btn btn-pdf">PDF</a><a href="szkice/${nr}.jpg" target="_blank" class="action-btn btn-png">JPG</a></div>
                </div>
                <div class="topo-section"><div class="topo-title">${t('field_compare')}</div>
                    <div class="pdf-action"><a href="porownania/${nr}.pdf" target="_blank" class="action-btn btn-pdf">PDF</a></div>
                </div>
                <div class="topo-section"><div class="topo-title">${t('navigation')}</div>
                    <div class="pdf-actions">
                        <a href="https://www.google.com/maps/search/?api=1&query=${latlng[0]},${latlng[1]}" target="_blank" class="action-btn" style="background:#4285F4; color:white;">Google Maps</a>
                        <a href="http://maps.apple.com/?daddr=${latlng[0]},${latlng[1]}" target="_blank" class="action-btn" style="background:#000; color:white;">Apple Maps</a>
                    </div>
                </div>
                <div class="topo-section section-raport"><div class="topo-title">${t('report')}</div><div class="pdf-actions" id="report-btn-container"></div></div>
            </div>
        </div>`;
    }

    initGeoJsonLayers() {
        this.zakresLayer = L.featureGroup();
        this.wizuryDobreLayer = L.featureGroup();
        this.wizuryUtrudnioneLayer = L.featureGroup();

        if (typeof zakresData !== 'undefined') {
            L.geoJSON(zakresData, { style: { color: "#a629c6", weight: 3, fillOpacity: 0.02 } }).addTo(this.zakresLayer);
            if (document.getElementById('layerZakres')?.checked) this.map.addLayer(this.zakresLayer);
        }
        
        if (typeof wizuryData !== 'undefined') {
            L.geoJSON(wizuryData, { 
                coordsToLatLng: coords => {
                    const wgs = proj4('EPSG:2178', 'EPSG:4326', [coords[0], coords[1]]);
                    return new L.LatLng(wgs[1], wgs[0]);
                },
                style: feature => ({ color: "#ef4444", weight: 2, opacity: 0.9, dashArray: (feature.properties?.typ === 'utrudniona') ? "5, 5" : null }),
                onEachFeature: (feature, layer) => {
                    (feature.properties?.typ === 'utrudniona') ? this.wizuryUtrudnioneLayer.addLayer(layer) : this.wizuryDobreLayer.addLayer(layer);
                }
            });
            if (document.getElementById('layerWizuryDobre')?.checked) this.map.addLayer(this.wizuryDobreLayer);
            if (document.getElementById('layerWizuryUtrudnione')?.checked) this.map.addLayer(this.wizuryUtrudnioneLayer);
        }
    }

    fitMapToBounds() {
        const activeLayers = Object.values(this.layers).filter(l => l.getLayers().length > 0);
        if (activeLayers.length > 0) {
            const group = L.featureGroup(activeLayers);
            this.map.fitBounds(group.getBounds(), { padding: [40, 40] });
        }
    }

    initLayerToggles() {
        const toggleLayer = (checkboxId, layerGroup) => {
            document.getElementById(checkboxId)?.addEventListener('change', (e) => {
                e.target.checked ? this.map.addLayer(layerGroup) : this.map.removeLayer(layerGroup); 
            });
        };
        
        toggleLayer('layerSzczegolowaPanstwowa', this.layers.szczegolowaPanstwowa);
        toggleLayer('layerSzczegolowaInne', this.layers.szczegolowaInne);
        toggleLayer('layerWysokosciowaPanstwowa', this.layers.wysokosciowaPanstwowa);
        toggleLayer('layerWysokosciowaInne', this.layers.wysokosciowaInne);
        toggleLayer('layerPomiarowaInne', this.layers.pomiarowaInne);
        toggleLayer('layerFundamentalna', this.layers.fundamentalna);
        toggleLayer('layerBazowa', this.layers.bazowa);
        toggleLayer('layerZakres', this.zakresLayer);
        toggleLayer('layerWizuryDobre', this.wizuryDobreLayer);
        toggleLayer('layerWizuryUtrudnione', this.wizuryUtrudnioneLayer);
    }

    initFilters() {
        const filters = ['filterDobry', 'filterUszkodzony', 'filterZniszczony'].map(id => document.getElementById(id));
        filters.forEach(cb => {
            if(cb) cb.addEventListener('change', () => {
                const showDobry = document.getElementById('filterDobry').checked;
                const showUszkodzony = document.getElementById('filterUszkodzony').checked;
                const showZniszczony = document.getElementById('filterZniszczony').checked;
                
                const markersToAdd = new Map();
                Object.values(this.layers).forEach(layer => {
                    layer.clearLayers();
                    markersToAdd.set(layer, []);
                });

                this.allMarkersData.forEach(item => {
                    const stan = String(item.props.stan_znaku || item.props.stan || '').toLowerCase();
                    let stanWizualny = stan.includes(STAN_ZNAKU.DOBRY) ? STAN_ZNAKU.DOBRY : 
                                       (stan.includes(STAN_ZNAKU.USZKODZONY) ? STAN_ZNAKU.USZKODZONY : STAN_ZNAKU.ZNISZCZONY);
                    
                    if ((stanWizualny === STAN_ZNAKU.DOBRY && showDobry) || 
                        (stanWizualny === STAN_ZNAKU.USZKODZONY && showUszkodzony) || 
                        (stanWizualny === STAN_ZNAKU.ZNISZCZONY && showZniszczony)) {
                        markersToAdd.get(item.targetGroup).push(item.layer);
                    }
                });

                for (let [group, markers] of markersToAdd) {
                    if (markers.length > 0) {
                        group.addLayers(markers);
                    }
                }
            });
        });
    }

    initSearch() {
        const searchInput = document.getElementById('searchInput');
        const customSuggestions = document.getElementById('customSuggestions');
        const searchError = document.getElementById('searchError');
        const searchBtn = document.getElementById('searchBtn');

        const performSearch = (forceId = null) => {
            const inputRaw = (typeof forceId === 'string') ? forceId : searchInput.value;
            const input = inputRaw.trim().toUpperCase();
            const targetLayer = this.pointsLayer[input];
            
            if (targetLayer) {
                searchError.style.display = 'none';
                
                Object.keys(this.layers).forEach(key => {
                    if (this.layers[key].hasLayer(targetLayer) && !this.map.hasLayer(this.layers[key])) {
                        this.map.addLayer(this.layers[key]);
                        const checkboxId = 'layer' + key.charAt(0).toUpperCase() + key.slice(1);
                        if(document.getElementById(checkboxId)) document.getElementById(checkboxId).checked = true;
                    }
                });
                
                this.map.setView(targetLayer.getLatLng(), 19, { animate: false });
                targetLayer.fire('click'); 
            } else if (input !== "") {
                searchError.innerText = t('point_not_found') + escapeHTML(input); 
                searchError.style.display = 'block'; 
                setTimeout(() => searchError.style.display = 'none', 3000);
            }
        };

        window.searchPoint = performSearch;

        if (searchBtn) searchBtn.addEventListener('click', performSearch);
        if (searchInput) {
            searchInput.addEventListener("keyup", (e) => { if (e.key === "Enter") performSearch(); });
            searchInput.addEventListener('input', (e) => {
                const val = e.target.value.trim().toUpperCase();
                customSuggestions.innerHTML = '';
                if (!val) { customSuggestions.style.display = 'none'; return; }
                
                const matches = Object.keys(this.pointsLayer).filter(nr => nr.includes(val)).slice(0, 6);
                
                if (matches.length > 0) {
                    customSuggestions.style.display = 'block';
                    matches.forEach(nr => {
                        const li = document.createElement('li');
                        li.textContent = nr;
                        li.addEventListener('click', () => {
                            searchInput.value = nr;
                            customSuggestions.style.display = 'none';
                            performSearch(); 
                        });
                        customSuggestions.appendChild(li);
                    });
                } else { customSuggestions.style.display = 'none'; }
            });
        }
        
        document.addEventListener('click', (e) => {
            if (searchInput && !searchInput.contains(e.target) && !customSuggestions.contains(e.target)) {
                customSuggestions.style.display = 'none';
            }
        });
    }

    initLegend() {
        const legend = L.control({position: 'bottomright'});
        legend.onAdd = function () {
            const div = L.DomUtil.create('div', 'info legend ui-panel');
            L.DomEvent.disableClickPropagation(div);
            L.DomEvent.disableScrollPropagation(div);
            div.innerHTML = `
                <div id="legend-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                    <b style="margin-bottom: 0;" data-i18n="legend">Legenda</b>
                    <svg id="legend-icon" style="width: 14px; height: 14px; transition: transform 0.3s; margin-left: 15px; color: #6b7280;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
                <div id="legend-content" style="margin-top: 10px; display: block;">
                    <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><rect x="5" y="5" width="90" height="90" fill="#FFFF00" stroke="#000000" stroke-width="10"/><line x1="27.5" y1="50" x2="72.5" y2="50" stroke="#000000" stroke-width="10" stroke-linecap="butt"/><line x1="50" y1="27.5" x2="50" y2="72.5" stroke="#000000" stroke-width="10" stroke-linecap="butt"/></svg><span data-i18n="leg_szczeg">Osnowa Szczegółowa (Państwowa)</span></div>
                    <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><rect x="5" y="5" width="90" height="90" fill="transparent" stroke="#000000" stroke-width="10"/><line x1="27.5" y1="50" x2="72.5" y2="50" stroke="#000000" stroke-width="10" stroke-linecap="butt"/><line x1="50" y1="27.5" x2="50" y2="72.5" stroke="#000000" stroke-width="10" stroke-linecap="butt"/></svg><span data-i18n="leg_szczeg_inne">Osnowa Szczegółowa (Inne)</span></div>
                    <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><polygon points="5,5 95,5 50,90" fill="#0000FF" stroke="#000000" stroke-width="10" stroke-linejoin="miter"/><line x1="32.5" y1="35" x2="67.5" y2="35" stroke="#FFFFFF" stroke-width="10" stroke-linecap="butt"/><line x1="50" y1="17.5" x2="50" y2="52.5" stroke="#FFFFFF" stroke-width="10" stroke-linecap="butt"/></svg><span data-i18n="leg_wys">Osnowa Szczegółowa Wysokościowa (Państwowa)</span></div>
                    <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><polygon points="5,5 95,5 50,90" fill="transparent" stroke="#000000" stroke-width="10" stroke-linejoin="miter"/><line x1="32.5" y1="35" x2="67.5" y2="35" stroke="#000000" stroke-width="10" stroke-linecap="butt"/><line x1="50" y1="17.5" x2="50" y2="52.5" stroke="#000000" stroke-width="10" stroke-linecap="butt"/></svg><span data-i18n="leg_wys_inne">Osnowa Szczegółowa Wysokościowa (Inne)</span></div>
                    <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><circle cx="50" cy="50" r="45" fill="transparent" stroke="#000000" stroke-width="6"/><polygon points="50,20 78,70 22,70" fill="#FFFF00" stroke="#000000" stroke-width="6"/><circle cx="50" cy="53" r="5" fill="#000000"/></svg><span data-i18n="leg_fund">Osnowa Fundamentalna Pozioma</span></div>
                    <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><polygon points="10,15 90,15 50,85" fill="#0000FF" stroke="#0000FF" stroke-width="5" stroke-linejoin="miter"/><circle cx="50" cy="40" r="6" fill="#FFFFFF"/></svg><span data-i18n="leg_baz">Osnowa Bazowa Wysokościowa</span></div>
                    <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg" style="border-radius:50%;"><circle cx="50" cy="65" r="30" fill="transparent" stroke="#000000" stroke-width="8"/><line x1="50" y1="35" x2="50" y2="5" stroke="#000000" stroke-width="8" stroke-linecap="round"/></svg><span data-i18n="leg_pom">Osnowa Pomiarowa</span></div>
                    <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><rect x="5" y="5" width="90" height="90" fill="transparent" stroke="#a629c6" stroke-width="15"/></svg><span data-i18n="leg_zakres">Zakres opracowania</span></div>
                    <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><line x1="0" y1="50" x2="100" y2="50" stroke="#ef4444" stroke-width="12"/></svg><span data-i18n="layer_wiz_dob">Wizury dobre</span></div>
                    <div class="legend-item"><svg viewBox="0 0 100 100" class="legend-svg"><line x1="0" y1="50" x2="100" y2="50" stroke="#ef4444" stroke-width="12" stroke-dasharray="20, 20"/></svg><span data-i18n="layer_wiz_zla">Wizury utrudnione</span></div>
                    <div style="margin-top: 10px;"></div>
                    <div class="legend-item"><div class="status-dot dot-dobry" style="position:relative; margin-right:12px; margin-left:4px;"></div><span data-i18n="leg_zach">Punkty Zachowane</span></div>
                    <div class="legend-item"><div class="status-dot dot-uszkodzony" style="position:relative; margin-right:12px; margin-left:4px;"></div><span data-i18n="leg_uszk">Punkty Uszkodzone</span></div>
                    <div class="legend-item"><div class="status-dot dot-zniszczony" style="position:relative; margin-right:12px; margin-left:4px;"></div><span data-i18n="leg_znisz">Punkty Zniszczone</span></div>
                </div>`;
            return div;
        };
        legend.addTo(this.map);
        
        setTimeout(() => {
            window.appDataManager && updateDOMTranslations();

            const header = document.getElementById('legend-header');
            const content = document.getElementById('legend-content');
            const icon = document.getElementById('legend-icon');
            if (header) {
                header.addEventListener('click', () => {
                    if (content.style.display === 'none') {
                        content.style.display = 'block'; icon.style.transform = 'rotate(180deg)';
                    } else {
                        content.style.display = 'none'; icon.style.transform = 'rotate(0deg)';
                    }
                });
                if (window.innerWidth <= 950 || window.innerHeight <= 550) {
                    content.style.display = 'none'; icon.style.transform = 'rotate(0deg)';
                } else {
                    icon.style.transform = 'rotate(180deg)';
                }
            }
        }, 100);
    }
}