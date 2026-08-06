// tutorial.js

import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { t } from './i18n.js';

function getDriverConfig() {
    return {
        showProgress: true,
        nextBtnText: t('tut_next'),
        prevBtnText: t('tut_prev'),
        doneBtnText: t('tut_done'),
        popoverClass: 'custom-driver-popover',
        allowClose: true
    };
}

function getSteps(isMobile) {
    const steps = [
        { popover: { title: t('tut_start_title'), description: t('tut_start_desc') } },
        { element: '.search-container', popover: { title: t('tut_search_title'), description: t('tut_search_desc'), side: "bottom", align: 'start' } },
        ...(isMobile ? [{ element: '#locateBtn', popover: { title: t('tut_loc_title'), description: t('tut_loc_desc_mob'), side: "right" } }] : []),
        { element: '.leaflet-popup', popover: { title: t('tut_popup_title'), description: t('tut_popup_desc'), side: isMobile ? "bottom" : "left", align: 'start' }, onHighlightStarted: () => { document.getElementById('searchInput').value = '712511112230'; window.searchPoint(); } },
        { element: '.topo-section:nth-of-type(1)', popover: { title: t('tut_topo_title'), description: t('tut_topo_desc'), side: "top" }, onHighlightStarted: () => { const popupBody = document.querySelector('.popup-body'); const target = document.querySelectorAll('.topo-section')[0]; if (popupBody && target) popupBody.scrollTop = target.offsetTop - 20; } },
        { element: '.topo-section:nth-of-type(2)', popover: { title: t('tut_comp_title'), description: t('tut_comp_desc'), side: "top" }, onHighlightStarted: () => { const popupBody = document.querySelector('.popup-body'); const target = document.querySelectorAll('.topo-section')[1]; if (popupBody && target) popupBody.scrollTop = target.offsetTop - 20; } },
        { element: '.topo-section:nth-of-type(3)', popover: { title: t('tut_nav_title'), description: t('tut_nav_desc'), side: "top" }, onHighlightStarted: () => { const popupBody = document.querySelector('.popup-body'); const target = document.querySelectorAll('.topo-section')[2]; if (popupBody && target) popupBody.scrollTop = target.offsetTop - 20; } },
        { element: '.section-raport', popover: { title: t('tut_rep_title'), description: t('tut_rep_desc'), side: "top", align: 'start' }, onHighlightStarted: () => { const target = document.querySelector('.section-raport'); if (target) target.scrollIntoView({ behavior: 'auto', block: 'center' }); } },
        ...(!isMobile ? [{ element: '#locateBtn', popover: { title: t('tut_loc_title'), description: t('tut_loc_desc'), side: "right" } }] : []),
        { element: isMobile ? '#mobileLayersBtn' : '#layersPanel', popover: { title: t('tut_lay_title'), description: t('tut_lay_desc'), side: isMobile ? "right" : "left" }, onHighlightStarted: () => { if (isMobile) { map.closePopup(); document.getElementById('layersPanel').classList.remove('mobile-active'); } } },
        { element: '#selectAreaBtn', popover: { title: t('tut_exp_title'), description: t('tut_exp_desc'), side: isMobile ? "top" : "left" }, onHighlightStarted: () => { if (isMobile) document.getElementById('layersPanel').classList.add('mobile-active'); const btn = document.getElementById('selectAreaBtn'); if (btn) { const content = btn.closest('.accordion-content'); if (content) { content.style.display = 'block'; if (content.previousElementSibling) content.previousElementSibling.classList.add('active'); } const layersBody = document.querySelector('.layers-body'); if (layersBody) layersBody.scrollTo({ top: btn.offsetTop - 60, behavior: 'smooth' }); } } },
        { element: '#measureBtn', popover: { title: t('tut_meas_title'), description: t('tut_meas_desc'), side: "right" }, onHighlightStarted: () => { if (isMobile) document.getElementById('layersPanel').classList.remove('mobile-active'); } },
        { element: '.info.legend', popover: { title: t('tut_leg_title'), description: t('tut_leg_desc'), side: "top" } },
        { element: '#coordinatesPanel', popover: { title: t('tut_trans_title'), description: t('tut_trans_desc'), side: "top" } },
        { element: '#faqBtn', popover: { title: t('tut_faq_title'), description: t('tut_faq_desc'), side: "right" } },
        { element: '#tutorialBtn', popover: { title: t('tut_re_title'), description: t('tut_re_desc'), side: "right" } },
        { element: '#bugBtn', popover: { title: t('tut_bug_title'), description: t('tut_bug_desc'), side: "right" } },
        { popover: { title: t('tut_end_title'), description: t('tut_end_desc') } }
    ];
    return steps;
}

export function initTutorial(map) {
    function startTutorial() {
        const isMobileView = window.innerWidth <= 950 || window.innerHeight <= 550;
        const initialCenter = map.getCenter();
        const initialZoom = map.getZoom();
        
        const driverObj = driver({
            ...getDriverConfig(),
            steps: getSteps(isMobileView),
            onDestroyed: () => {
                map.closePopup();
                map.setView(initialCenter, initialZoom);
                document.getElementById('searchInput').value = '';
            }
        });
        driverObj.drive();
    }

    const tutorialBtn = document.getElementById('tutorialBtn');
    if (tutorialBtn) tutorialBtn.addEventListener('click', (e) => { e.stopPropagation(); startTutorial(); });

    const welcomeModal = document.getElementById('welcomeModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const startTutorialFromModalBtn = document.getElementById('startTutorialFromModalBtn');
    
    if (!sessionStorage.getItem('welcomeModalSeen') && welcomeModal) welcomeModal.style.display = 'flex';
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => { welcomeModal.style.display = 'none'; sessionStorage.setItem('welcomeModalSeen', 'true'); });
    if (startTutorialFromModalBtn) startTutorialFromModalBtn.addEventListener('click', () => { welcomeModal.style.display = 'none'; sessionStorage.setItem('welcomeModalSeen', 'true'); startTutorial(); });
}