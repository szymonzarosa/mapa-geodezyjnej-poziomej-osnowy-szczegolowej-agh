// app.js
import L from 'leaflet';
window.L = L;
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { initUI, initMobileMenu } from './ui.js';
import { initTutorial } from './tutorial.js';
import { MapManager } from './MapManager.js';
import { MeasurementTool } from './MeasurementTool.js';
import { DataManager } from './DataManager.js';
import { ExportManager } from './ExportManager.js';
import { initI18n } from './i18n.js';
import { StatsManager } from './StatsManager.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

initI18n();
initUI();
initMobileMenu(); 

registerSW({
  onNeedRefresh() { console.log('Update available. Refresh the page.'); },
  onOfflineReady() { console.log('App is ready for offline use.'); },
});

const mapManager = new MapManager('map');
const map = mapManager.map;

const measureTool = new MeasurementTool(map);
initTutorial(map);

window.appDataManager = new DataManager(map, SUPABASE_URL, SUPABASE_KEY);
window.appDataManager.initData();

const exportManager = new ExportManager(map, window.appDataManager);
const statsManager = new StatsManager(window.appDataManager);