// utils.js

export function showLoader(text = 'Przetwarzanie...') {
    document.getElementById('loaderText').innerText = text;
    document.getElementById('globalLoader').style.display = 'flex';
}

export function hideLoader() {
    document.getElementById('globalLoader').style.display = 'none';
}

export function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function getPl2000Zone(lng) {
    if (lng < 16.5) return { epsg: 'EPSG:2176', zone: 5 };
    if (lng < 19.5) return { epsg: 'EPSG:2177', zone: 6 };
    if (lng < 22.5) return { epsg: 'EPSG:2178', zone: 7 };
    return { epsg: 'EPSG:2179', zone: 8 };
}