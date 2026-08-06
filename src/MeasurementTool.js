// MeasurementTool.js

import L from 'leaflet';
import GeographicLib from 'geographiclib';
import { t } from './i18n.js';

export class MeasurementTool {
    constructor(map) {
        this.map = map;
        this.isMeasuring = false;
        this.measureMode = 'distance';
        this.measurePoints = [];
        
        const vectorStyle = { color: '#e63946', weight: 2, dashArray: '6, 6', interactive: false };
        this.measurePolyline = L.polyline([], vectorStyle).addTo(map);
        this.measurePolygon = L.polygon([], { ...vectorStyle, fillColor: '#e63946', fillOpacity: 0.15 }).addTo(map);
        this.measureMarkers = L.layerGroup().addTo(map);
        this.measureDistEl = document.getElementById('measure-dist');
        this.measureAreaEl = document.getElementById('measure-area');

        this.bindEvents();
    }

    bindEvents() {
        const measureBtn = document.getElementById('measureBtn');
        const measurePanel = document.getElementById('measurePanel');
        
        if (measureBtn) {
            L.DomEvent.disableClickPropagation(measureBtn);
            measureBtn.addEventListener('click', () => this.toggleMeasure());
        }
        if (measurePanel) {
            L.DomEvent.disableClickPropagation(measurePanel);
        }

        document.querySelectorAll('input[name="measureMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.measureMode = e.target.value; 
                document.getElementById('row-area').style.display = this.measureMode === 'area' ? 'flex' : 'none'; 
                const label = document.getElementById('measure-dist-label');
                if (this.measureMode === 'area') {
                    label.setAttribute('data-i18n', 'perimeter');
                    label.innerText = t('perimeter');
                } else {
                    label.setAttribute('data-i18n', 'distance');
                    label.innerText = t('distance');
                }
                
                this.clearMeasurement();
            });
        });

        document.getElementById('measure-undo')?.addEventListener('click', () => { 
            if (this.measurePoints.length > 0) { 
                this.measurePoints.pop(); 
                this.updateDisplay(); 
            } 
        });
        document.getElementById('measure-clear')?.addEventListener('click', () => this.clearMeasurement());
    }

    toggleMeasure() {
        const mapContainer = document.getElementById('map');
        const measureBtn = document.getElementById('measureBtn');
        const measurePanel = document.getElementById('measurePanel');

        this.isMeasuring = !this.isMeasuring;
        
        if (this.isMeasuring) {
            if (measureBtn) measureBtn.classList.add('btn-active');
            if (mapContainer) mapContainer.style.cursor = 'crosshair';
            if (measurePanel) measurePanel.style.display = 'block';
            this.map.on('click', this.handleMapClick, this);
        } else {
            if (measureBtn) measureBtn.classList.remove('btn-active');
            if (mapContainer) mapContainer.style.cursor = '';
            if (measurePanel) measurePanel.style.display = 'none';
            this.map.off('click', this.handleMapClick, this); 
            this.clearMeasurement();
        }
    }

    handleMapClick(e) {
        this.measurePoints.push(e.latlng);
        this.updateDisplay();
    }

    clearMeasurement() {
        this.measurePoints = [];
        this.updateDisplay();
    }

    updateDisplay() {
        this.measureMarkers.clearLayers();
        this.measurePoints.forEach(pt => { 
            L.circleMarker(pt, { radius: 4, color: '#fff', weight: 1.5, fillColor: '#e63946', fillOpacity: 1, interactive: false }).addTo(this.measureMarkers); 
        });
        
        this.measurePolyline.setLatLngs(this.measurePoints);
        if (this.measureMode === 'area' && this.measurePoints.length > 2) {
            this.measurePolygon.setLatLngs(this.measurePoints);
        } else {
            this.measurePolygon.setLatLngs([]);
        }
        
        this.calculate();
    }

    calculate() {
        if (this.measurePoints.length < 2) { 
            if (this.measureDistEl) this.measureDistEl.innerText = '0.00 m'; 
            if (this.measureAreaEl) this.measureAreaEl.innerText = '0.00 m²'; 
            return; 
        }
        
        if (!this.geod) this.geod = GeographicLib.Geodesic.WGS84;
        const isPolyline = this.measureMode === 'distance';
        const poly = this.geod.Polygon(isPolyline);       
        this.measurePoints.forEach(p => poly.AddPoint(p.lat, p.lng));
        const result = poly.Compute(false, true);
        const dist = result.perimeter; 
        
        if (this.measureDistEl) {
            this.measureDistEl.innerText = dist > 1000 ? (dist / 1000).toFixed(3) + ' km' : dist.toFixed(2) + ' m';
        }
        
        if (!isPolyline && this.measureAreaEl) {
            const area = Math.abs(result.area);
            this.measureAreaEl.innerText = area > 10000 ? (area / 10000).toFixed(4) + ' ha' : area.toFixed(2) + ' m²';
        }
    }
}