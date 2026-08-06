// IconManager.js

import L from 'leaflet';
import { STAN_ZNAKU } from './constants.js';

export class IconManager {
    static cache = {};

    static getIcon(type, stan, nr, isPanstwowa = true) {
        const key = `${type}_${stan}_${isPanstwowa}`;
        
        if (!this.cache[key]) {
            let dotClass = 'dot-zniszczony';
            
            if (stan && stan.toLowerCase().includes(STAN_ZNAKU.DOBRY)) {
                dotClass = 'dot-dobry';
            } else if (stan && stan.toLowerCase().includes(STAN_ZNAKU.USZKODZONY)) {
                dotClass = 'dot-uszkodzony';
            }

            let svgContent = '';
            
            switch (type) {
                case 'szczegolowa': {
                    const fillColor = isPanstwowa ? "#FFFF00" : "transparent";
                    svgContent = `
                        <svg viewBox="0 0 100 100" class="osnowa-svg">
                            <rect x="5" y="5" width="90" height="90" fill="${fillColor}" stroke="#000000" stroke-width="10"/>
                            <line x1="27.5" y1="50" x2="72.5" y2="50" stroke="#000000" stroke-width="10" stroke-linecap="butt"/>
                            <line x1="50" y1="27.5" x2="50" y2="72.5" stroke="#000000" stroke-width="10" stroke-linecap="butt"/>
                        </svg>`;
                    break;
                }
                case 'wysokosciowa': {
                    const fillColor = isPanstwowa ? "#0000FF" : "transparent";
                    const crossColor = isPanstwowa ? "#FFFFFF" : "#000000";
                    svgContent = `
                        <svg viewBox="0 0 100 100" class="osnowa-svg">
                            <polygon points="5,5 95,5 50,90" fill="${fillColor}" stroke="#000000" stroke-width="10" stroke-linejoin="miter"/>
                            <line x1="32.5" y1="35" x2="67.5" y2="35" stroke="${crossColor}" stroke-width="10" stroke-linecap="butt"/>
                            <line x1="50" y1="17.5" x2="50" y2="52.5" stroke="${crossColor}" stroke-width="10" stroke-linecap="butt"/>
                        </svg>`;
                    break;
                }
                case 'fundamentalna': {
                    svgContent = `
                        <svg viewBox="0 0 100 100" class="osnowa-svg">
                            <circle cx="50" cy="50" r="45" fill="transparent" stroke="#000000" stroke-width="6"/>
                            <polygon points="50,20 78,70 22,70" fill="#FFFF00" stroke="#000000" stroke-width="6"/>
                            <circle cx="50" cy="53" r="5" fill="#000000"/>
                        </svg>`;
                    break;
                }
                case 'bazowa': {
                    svgContent = `
                        <svg viewBox="0 0 100 100" class="osnowa-svg">
                            <polygon points="10,15 90,15 50,85" fill="#0000FF" stroke="#0000FF" stroke-width="5" stroke-linejoin="miter"/>
                            <circle cx="50" cy="40" r="6" fill="#FFFFFF"/>
                        </svg>`;
                    break;
                }
                case 'pomiarowa': {
                    svgContent = `
                        <svg viewBox="0 0 100 100" class="pomiarowa-svg">
                            <circle cx="50" cy="65" r="30" fill="transparent" stroke="#000000" stroke-width="8"/>
                            <line x1="50" y1="35" x2="50" y2="5" stroke="#000000" stroke-width="8" stroke-linecap="round"/>
                        </svg>`;
                    break;
                }
                default:
                    svgContent = '';
            }

            this.cache[key] = { svg: svgContent, dotClass: dotClass };
        }

        const { svg, dotClass } = this.cache[key];
        const labelHtml = nr ? `<div class="icon-nr-label">${nr}</div>` : '';
        
        return L.divIcon({ 
            className: '', 
            html: `<div class="custom-osnowa-icon">${svg}<div class="status-dot ${dotClass}"></div>${labelHtml}</div>`, 
            iconSize: [24, 24], 
            iconAnchor: [12, 12], 
            popupAnchor: [0, -14] 
        });
    }
}