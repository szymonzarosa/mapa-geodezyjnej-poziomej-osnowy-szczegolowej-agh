# Mapa Interaktywna Poziomej Osnowy Geodezyjnej Krakowa

<p align="center">
  <img src="https://img.shields.io/badge/wersja-1.0.0-blue?style=flat-square" alt="Wersja">
  <img src="https://img.shields.io/badge/AGH-Geodezja_i_Kartografia-success?style=flat-square" alt="AGH">
  <img src="https://img.shields.io/badge/Vite-8.1.0-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Leaflet-1.9.4-199900?style=flat-square&logo=leaflet&logoColor=white" alt="Leaflet">
</p>

Interaktywna aplikacja WebGIS stanowiąca integralną część pracy inżynierskiej pt. **"Inwentaryzacja geodezyjnej poziomej osnowy szczegółowej wraz z projektem modernizacji na wybranym terenie Miasta Krakowa"**.

Aplikacja służy do wizualizacji stanu osnowy, analizy atrybutów poszczególnych punktów, wykonywania pomiarów przestrzennych na mapie oraz eksportu danych do zewnętrznych formatów analitycznych.

---

## Spis treści
1. [Główne funkcjonalności](#główne-funkcjonalności)
2. [Wykorzystane technologie](#wykorzystane-technologie)
3. [Instalacja i uruchomienie lokalne](#instalacja-i-uruchomienie-lokalne)
4. [Struktura zmiennych środowiskowych](#struktura-zmiennych-środowiskowych)
5. [Autorzy i afiliacja](#autorzy-i-afiliacja)

---

## Główne funkcjonalności

* **Interaktywna wizualizacja GIS:** Renderowanie punktów osnowy szczegółowej i pomiarowej na wielu podkładach mapowych (CartoDB Voyager, Ortofotomapa Geoportal/Esri, OpenTopoMap) wraz z technologią klasteryzacji znaczników (`Leaflet.markercluster`).
* **Filtrowanie i wyszukiwanie:** Wyszukiwarka punktów z automatycznym systemem podpowiedzi (szukanie po fragmencie numeru) oraz dynamiczne filtrowanie według stanu technicznego znaku (zachowany, uszkodzony, zniszczony).
* **Integracja z usługami WMS:** Bezpośrednia obsługa zewnętrznych usług sieciowych GUGiK – Krajowej Integracji Ewidencji Gruntów (KIEG - działki i budynki) oraz Ewidencji Miejscowości, Ulic i Adresów (EMUiA).
* **Narzędzia analityczno-pomiarowe:** Wbudowany moduł obliczeniowy do wyznaczania odległości, obwodów oraz pól powierzchni obiektów z automatyczną transformacją współrzędnych do państwowego układu odniesienia **PL-2000 (strefa 7)**.
* **Eksport danych przestrzennych:** Możliwość geometrycznego zdefiniowania obszaru (prostokąt selekcji) i eksportu odfiltrowanych punktów osnowy do plików **CSV** oraz **GeoJSON**.
* **Moduł terenowy i nawigacyjny:** Funkcja geolokalizacji użytkownika w czasie rzeczywistym oraz bezpośrednie linkowanie do aplikacji nawigacyjnych (Google Maps / Apple Maps) ze współrzędnymi wybranego punktu.
* **Cyfrowa baza dokumentacji:** Dynamiczny dostęp z poziomu karty punktu do opisów topograficznych w formatach PDF/JPG oraz map porównania z terenem.

---

## Wykorzystane technologie

* **Frontend Core:** HTML5, CSS3 (zmienne CSS, architektura Glassmorphism), JavaScript (Vanilla ES6 Modules)
* **Biblioteki mapowe:** Leaflet.js v1.9.4
* **Obliczenia geodezyjne:** Proj4js v2.20.9 (definicje układów EPSG:2178, EPSG:4326)
* **Baza danych i Backend:** Supabase (PostgreSQL) (pobieranie danych asynchronicznymi zapytaniami przez REST API)
* **Interfejs użytkownika (UX):** Driver.js v1.6.0 (samouczek dla urządzeń desktopowych oraz mobilnych)
* **Środowisko uruchomieniowe i Bundler:** Vite v8.1.0

---

## Instalacja i uruchomienie lokalne

Aby uruchomić projekt w lokalnym środowisku programistycznym, należy wykonać następujące kroki:

1. **Sklonuj repozytorium:**
   ```bash
   git clone https://github.com/szymonzarosa/mapa-geodezyjnej-poziomej-osnowy-szczegolowej-agh.git
   cd mapa-geodezyjnej-poziomej-osnowy-szczegolowej-agh
   ```

2. **Zainstaluj wymagane pakiety `npm`:**
   ```bash
   npm install
   ```

3. **Uruchom lokalny serwer deweloperski:**
   ```bash
   npm run dev
   ```
   Aplikacja zostanie uruchomiona pod adresem deweloperskim (najczęściej `http://localhost:5173`).

4. **Kompilacja produkcyjna (Build):**
   ```bash
   npm run build
   ```
   Zoptymalizowane i skompilowane pliki produkcyjne gotowe do wdrożenia na serwer (np. Netlify) zostaną wygenerowane w katalogu `/dist`.

---

## Struktura zmiennych środowiskowych

Projekt wymaga konfiguracji połączenia z bazą danych Supabase. W głównym katalogu aplikacji należy utworzyć plik `.env` i uzupełnić go według poniższego wzoru:

```env
VITE_SUPABASE_URL=https://twój-projekt-id.supabase.co
VITE_SUPABASE_KEY=twój-publiczny-klucz-anon-supabase
```

**Uwaga:** Plik `.env` zawiera klucze konfiguracyjne i jest automatycznie ignorowany przez system kontroli wersji za pomocą instrukcji w pliku `.gitignore`.

---

## Autorzy i afiliacja

* **Autorzy:** Szymon Zarosa, Szymon Kobacki
* **Kierunek studiów:** Geodezja i Kartografia
* **Uczelnia:** Akademia Górniczo-Hutnicza im. Stanisława Staszica w Krakowie
* **Wydział:** Wydział Geodezji Górniczej i Inżynierii Środowiska
* **Katedra:** Katedra Geodezji Zintegrowanej i Kartografii
* **Opiekun pracy:** dr inż. Mikołaj Skulich, prof. AGH

**Kraków, 2026**
