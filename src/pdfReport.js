import html2pdf from 'html2pdf.js';
import { showLoader, hideLoader, getPl2000Zone } from './utils.js';

export const generateReport = function(nr, lng, x, y, h, typ, stab, stan) {
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
    
    const createPdf = () => {
        showLoader('Generowanie metryczki PDF...');
        const options = {
            margin:       0,
            filename:     `Metryczka_Punktu_${nr}.pdf`,
            image:        { type: 'jpeg', quality: 1.0 },
            html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        reportElement.style.display = 'flex';

        html2pdf().set(options).from(reportElement).save().then(() => {
            document.title = originalTitle;
            reportElement.style.display = 'none';
            hideLoader();
        });
    };

    imgElement.onload = null;
    imgElement.onerror = null;
    
    imgElement.src = `szkice/${nr}.jpg`;

    if (imgElement.complete) {
        createPdf();
    } else {
        imgElement.onload = function() {
            imgElement.onload = null;
            imgElement.onerror = null;
            createPdf();
        };
        
        imgElement.onerror = function() {
            imgElement.onload = null;
            imgElement.onerror = null; 
            
            imgElement.src = '';
            imgElement.alt = 'Brak szkicu topograficznego dla tego punktu w bazie.';
            createPdf();
        };
    }
};