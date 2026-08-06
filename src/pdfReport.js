// pdfReport.js

import { showLoader, hideLoader, getPl2000Zone } from './utils.js';
import { t, tv, getCurrentLang } from './i18n.js';

export const generateReport = function(nr, lng, x, y, h, typ, stab, stan, klasa = '') {
    const originalTitle = document.title;
    document.title = `${t('report_filename')}_${nr}`;
    
    const isPodstawowa = klasa.toLowerCase().includes('fundamentalna') || klasa.toLowerCase().includes('bazowa');
    const precisionXY = 2;
    const precisionH = isPodstawowa ? 4 : 3;
    
    document.getElementById('reportNr').innerText = `${t('print_point_nr')} ${nr}`;
    document.getElementById('reportX').innerText = parseFloat(x).toFixed(precisionXY) + ' m';
    document.getElementById('reportY').innerText = parseFloat(y).toFixed(precisionXY) + ' m';
    document.getElementById('reportH').innerText = isNaN(parseFloat(h)) ? t('no_data') : parseFloat(h).toFixed(precisionH) + ' m';
    document.getElementById('reportType').innerText = tv(typ) || '-';
    document.getElementById('reportStab').innerText = tv(stab) || '-';
    document.getElementById('reportStan').innerText = t(stan).toUpperCase();
    
    const locale = getCurrentLang() === 'pl' ? 'pl-PL' : 'en-GB';
    document.getElementById('reportDate').innerText = new Date().toLocaleDateString(locale);

    const imgElement = document.getElementById('reportSzkic');
    const reportElement = document.getElementById('printReport');
    
    const createPdf = async () => {
        showLoader(t('generating_pdf'));
        
        try {
            const module = await import('html2pdf.js');
            const html2pdf = module.default || module;

            const options = {
                margin:       0,
                filename:     `${t('report_filename')}_${nr}.pdf`,
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
        } catch (error) {
            console.error("PDF Library Error:", error);
            hideLoader();
            alert(t('pdf_error'));
        }
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
            imgElement.alt = t('no_sketch');
            createPdf();
        };
    }
};