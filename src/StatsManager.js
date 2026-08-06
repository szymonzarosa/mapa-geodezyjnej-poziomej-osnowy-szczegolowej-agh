// StatsManager.js

import { t } from './i18n.js';

export class StatsManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.chartStan = null;
        this.chartKlasa = null;
        this.bindEvents();
        console.log("StatsManager loaded successfully.");
    }

    bindEvents() {
        const statsBtn = document.getElementById('statsBtn');
        const statsModal = document.getElementById('statsModal');
        const closeIcon = document.getElementById('closeStatsIcon');

        if (statsBtn) {
            statsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (statsModal) statsModal.style.display = 'flex';
                this.renderCharts();
            });
        }

        if (closeIcon) {
            closeIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (statsModal) statsModal.style.display = 'none';
            });
        }
        
        if (statsModal) {
            statsModal.addEventListener('click', (e) => {
                if (e.target === statsModal) statsModal.style.display = 'none';
            });
        }
    }

    async renderCharts() {
        const data = this.dataManager.allMarkersData;
        if (data.length === 0) {
            console.warn("No data to generate statistics.");
            return;
        }

        let Chart;
        try {
            console.log("Loading Chart.js library...");
            const module = await import('chart.js/auto');
            Chart = module.default || module;
        } catch(e) {
            console.error("Error loading Chart.js:", e);
            return;
        }

        const countsStan = { 'Dobry': 0, 'Uszkodzony': 0, 'Zniszczony': 0 };
        const countsKlasa = {};

        data.forEach(item => {
            const stan = String(item.props.stan_znaku || '').toLowerCase();
            if (stan.includes('dobry')) countsStan['Dobry']++;
            else if (stan.includes('uszkodzony')) countsStan['Uszkodzony']++;
            else countsStan['Zniszczony']++;

            let klasa = String(item.props.klasa_punktu || 'Brak danych').trim();
            klasa = klasa.charAt(0).toUpperCase() + klasa.slice(1);
            if (!countsKlasa[klasa]) countsKlasa[klasa] = 0;
            countsKlasa[klasa]++;
        });

        if (this.chartStan) this.chartStan.destroy();
        if (this.chartKlasa) this.chartKlasa.destroy();

        const labelsStan = Object.keys(countsStan).map(key => {
            if (key === 'Dobry') return t('stat_good');
            if (key === 'Uszkodzony') return t('stat_dmg');
            if (key === 'Zniszczony') return t('stat_dest');
            return key;
        });

        const ctxStan = document.getElementById('chartStan').getContext('2d');
        this.chartStan = new Chart(ctxStan, {
            type: 'pie',
            data: {
                labels: labelsStan,
                datasets: [{
                    data: Object.values(countsStan),
                    backgroundColor: ['#10b981', '#eab308', '#ef4444'],
                    borderWidth: 1
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });

        const labelsKlasa = Object.keys(countsKlasa).map(key => {
            const k = key.toLowerCase();
            if (k.includes('fundamentalna')) return t('stat_fund');
            if (k.includes('bazowa')) return t('stat_base');
            if (k.includes('szczegółowa')) return t('stat_detail');
            if (k.includes('pomiarowa')) return t('stat_meas');
            if (k.includes('wysokościowa')) return t('stat_vert');
            return key;
        });
        
        const klasaValues = Object.values(countsKlasa);
        const ctxKlasa = document.getElementById('chartKlasa').getContext('2d');
        
        this.chartKlasa = new Chart(ctxKlasa, {
            type: 'doughnut',
            data: {
                labels: labelsKlasa,
                datasets: [{
                    data: klasaValues,
                    backgroundColor: labelsKlasa.map((_, i) => `hsl(${210 + (i * 30)}, 70%, 50%)`),
                    borderWidth: 1
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }
}