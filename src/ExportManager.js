// ExportManager.js

import L from 'leaflet';
import { t } from './i18n.js';

export class ExportManager {
    constructor(map, dataManager) {
        this.map = map;
        this.dataManager = dataManager;
        
        this.isDrawingExportBox = false;
        this.selectionStartPoint = null;
        this.exportSelectionBox = null; 
        this.exportSelectionBounds = null; 

        this.bindEvents();
    }

    bindEvents() {
        const selectAreaBtn = document.getElementById('selectAreaBtn');
        const floatExportCancel = document.getElementById('floatExportCancel');
        const floatExportCsv = document.getElementById('floatExportCsv');
        const floatExportGeoJson = document.getElementById('floatExportGeoJson');
        const exportCsvBtn = document.getElementById('exportCsvBtn');
        const exportGeoJsonBtn = document.getElementById('exportGeoJsonBtn');

        if (selectAreaBtn) {
            selectAreaBtn.addEventListener('click', () => this.startSelection());
        }
        
        this.map.on('click', (e) => this.handleMapClick(e));
        this.map.on('mousemove', (e) => this.handleMapMove(e));

        if (floatExportCancel) floatExportCancel.addEventListener('click', () => this.clearSelection());
        if (floatExportCsv) floatExportCsv.addEventListener('click', () => this.exportToCsv());
        if (floatExportGeoJson) floatExportGeoJson.addEventListener('click', () => this.exportToGeoJson());
        if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => this.exportToCsv());
        if (exportGeoJsonBtn) exportGeoJsonBtn.addEventListener('click', () => this.exportToGeoJson());
    }

    startSelection() {
        const layersPanel = document.getElementById('layersPanel');
        if (layersPanel) layersPanel.classList.remove('mobile-active');

        this.isDrawingExportBox = true;
        this.selectionStartPoint = null;
        document.getElementById('map').style.cursor = 'crosshair';
        
        const panel = document.getElementById('exportFloatingPanel');
        if (panel) panel.style.display = 'flex';
        
        document.getElementById('exportActionButtons').style.display = 'none';
        document.getElementById('exportInstructions').innerText = t('exp_inst_1');
    }

    handleMapClick(e) {
        if (!this.isDrawingExportBox) return;

        if (!this.selectionStartPoint) {
            this.selectionStartPoint = e.latlng; 
            this.exportSelectionBox = L.rectangle([this.selectionStartPoint, this.selectionStartPoint], { 
                color: "var(--success-color)", weight: 2, fillOpacity: 0.2, interactive: false 
            }).addTo(this.map);
            document.getElementById('exportInstructions').innerText = t('exp_inst_2');
        } else {
            this.exportSelectionBox.setBounds([this.selectionStartPoint, e.latlng]);
            this.exportSelectionBounds = this.exportSelectionBox.getBounds(); 
            this.isDrawingExportBox = false; 
            document.getElementById('map').style.cursor = '';
            
            document.getElementById('exportInstructions').innerText = t('exp_inst_3');
            document.getElementById('exportActionButtons').style.display = 'flex';
        }
    }

    handleMapMove(e) {
        if (this.isDrawingExportBox && this.selectionStartPoint && this.exportSelectionBox) {
            this.exportSelectionBox.setBounds([this.selectionStartPoint, e.latlng]);
        }
    }

    clearSelection() { 
        this.isDrawingExportBox = false; 
        this.selectionStartPoint = null; 
        document.getElementById('map').style.cursor = '';
        document.getElementById('exportFloatingPanel').style.display = 'none';
        if (this.exportSelectionBox) { 
            this.map.removeLayer(this.exportSelectionBox); 
            this.exportSelectionBox = null; 
            this.exportSelectionBounds = null; 
        } 
    }

    getVisibleFeatures() {
        let features = []; 
        Object.keys(this.dataManager.layers).forEach(key => {
            const checkbox = document.getElementById('layer' + key.charAt(0).toUpperCase() + key.slice(1));
            if (checkbox && checkbox.checked) {
                this.dataManager.layers[key].eachLayer(marker => {
                    if (marker.feature) {
                        if (this.exportSelectionBounds) { 
                            if (this.exportSelectionBounds.contains(marker.getLatLng())) features.push(marker.feature); 
                        } else {
                            features.push(marker.feature);
                        }
                    }
                });
            }
        });
        return features;
    }

    exportToCsv() {
        const features = this.getVisibleFeatures(); 
        if (features.length === 0) { alert(t('exp_empty')); return; }
        const headers = ["numer_punktu", "x_pl2000", "y_pl2000", "h_evrf2007", "dx", "dy", "stan_znaku", "rodzaj_stabilizacji", "typ_znaku", "zrodlo_danych", "klasa_punktu"];
        let csvContent = "\uFEFF" + headers.join(";") + "\n";
        
        features.forEach(f => {
            const p = f.properties;
            const row = headers.map(header => { 
                let val = p[header] !== undefined && p[header] !== null ? String(p[header]) : ""; 
                
                if (header === "numer_punktu" && /^\d+$/.test(val) && val.length > 8) {
                    return `="${val}"`;
                }

                val = val.replace(/"/g, '""'); 
                if (val.search(/("|,|;|\n)/g) >= 0) val = `"${val}"`; 
                return val; 
            });
            csvContent += row.join(";") + "\n";
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); 
        const url = URL.createObjectURL(blob); 
        const link = document.createElement("a"); 
        link.setAttribute("href", url); 
        link.setAttribute("download", `osnowa_agh_eksport_${new Date().toISOString().slice(0,10)}.csv`); 
        link.click();
        
        this.clearSelection();
    }

    exportToGeoJson() {
        const features = this.getVisibleFeatures(); 
        if (features.length === 0) { alert("Brak punktów w zaznaczonym obszarze."); return; }
        const blob = new Blob([JSON.stringify({ type: "FeatureCollection", features: features }, null, 2)], { type: 'application/json' }); 
        const url = URL.createObjectURL(blob); 
        const link = document.createElement("a"); 
        link.setAttribute("href", url); 
        link.setAttribute("download", `osnowa_agh_eksport_${new Date().toISOString().slice(0,10)}.geojson`); 
        link.click();
        
        this.clearSelection();
    }
}