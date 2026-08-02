import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const driverConfig = {
    showProgress: true,
    nextBtnText: 'Dalej ➔',
    prevBtnText: '🠔 Wstecz',
    doneBtnText: 'Zakończ',
    popoverClass: 'custom-driver-popover',
    allowClose: true
};

const desktopSteps = [
    { 
        popover: { 
            title: 'Witaj w aplikacji!', 
            description: "Ten przewodnik pokaże Ci, jak korzystać z dostępnych narzędzi. Kliknij 'Dalej', aby rozpocząć." 
        } 
    },
    { 
        element: '.search-container', 
        popover: { 
            title: 'Wyszukiwanie', 
            description: 'Wpisz fragment numeru punktu. System wyświetli listę podpowiedzi, a po zatwierdzeniu automatycznie wyśrodkuje mapę i otworzy kartę informacyjną ze szczegółami.', 
            side: "bottom", 
            align: 'start' 
        } 
    },
    { 
        element: '.leaflet-popup', 
        popover: { 
            title: 'Karta informacyjna punktu', 
            description: 'Przeanalizujmy atrybuty na przykładzie punktu 712511112230. Znajdziesz tu m.in. typ znaku (rurka hartowana), rodzaj stabilizacji (Naziemny), wysokość, współrzędne oraz klasę osnowy.', 
            side: "left", 
            align: 'start' 
        },
        onHighlightStarted: () => {
            document.getElementById('searchInput').value = '712511112230';
			window.searchPoint();
        }
    },
    { 
        element: '.topo-section:nth-of-type(1)', 
        popover: { 
            title: 'Opis topograficzny', 
            description: 'Tutaj możesz wyświetlić (lub pobrać) opis topograficzny w formacie PDF oraz JPG.', 
            side: "top" 
        },
        onHighlightStarted: () => {
            const popupBody = document.querySelector('.popup-body');
            const target = document.querySelectorAll('.topo-section')[0];
            if (popupBody && target) popupBody.scrollTop = target.offsetTop - 20;
        }
    },
    { 
        element: '.topo-section:nth-of-type(2)', 
        popover: { 
            title: 'Mapa porównania z terenem', 
            description: 'Narzędzie pozwala wyświetlić plik PDF z mapą porównania z terenem.', 
            side: "top" 
        },
        onHighlightStarted: () => {
            const popupBody = document.querySelector('.popup-body');
            const target = document.querySelectorAll('.topo-section')[1];
            if (popupBody && target) popupBody.scrollTop = target.offsetTop - 20;
        }
    },
    { 
        element: '.topo-section:nth-of-type(3)', 
        popover: { 
            title: 'Nawigacja do punktu', 
            description: 'Opcja wyjątkowo przydatna w terenie. Jednym kliknięciem uruchomisz trasę w aplikacjach Google Maps lub Apple Maps prosto do lokalizacji znaku.', 
            side: "top" 
        },
        onHighlightStarted: () => {
            const popupBody = document.querySelector('.popup-body');
            const target = document.querySelectorAll('.topo-section')[2];
            if (popupBody && target) popupBody.scrollTop = target.offsetTop - 20;
        }
    },
    { 
        element: '.section-raport', 
        popover: { 
            title: 'Metryczka punktu', 
            description: 'Funkcja ta pozwala na wygenerowanie automatycznego raportu odnośnie punktu osnowy w formacie PDF. Dane w raporcie tworzone są na podstawie danych opisowych znaku oraz opisu topograficznego.', 
            side: "top",
            align: 'start'
        },
        onHighlightStarted: () => {
            const target = document.querySelector('.section-raport');
            if (target) target.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
    },
    { 
        element: '#locateBtn', 
        popover: { 
            title: 'Lokalizacja urządzenia',
            description: 'Po kliknięciu danej opcji, aplikacja automatycznie wskaże oraz przeniesie Cię w Twoje aktualne położenie.', 
            side: "right" 
        } 
    },
    { 
        element: '#measureBtn', 
        popover: { 
            title: 'Pomiary', 
            description: 'Narzędzie umożliwiające pomiar odległości oraz pola powierzchni.', 
            side: "right" 
        } 
    },
    { 
        element: '#layersPanel', 
        popover: { 
            title: 'Zarządzanie widokiem mapy oraz prezentacji danych', 
            description: 'Zarządzanie widokiem. Otwórz panel, aby przełączać podkłady mapowe, uruchamiać usługi WMS i dostosowywać wyświetlane warstwy.', 
            side: "left" 
        } 
    },
    { 
        element: '#selectAreaBtn', 
        popover: { 
            title: 'Eksport danych', 
            description: 'Narzędzie do pobierania danych. Zaznacz na mapie interesujący Cię obszar, a następnie wyeksportuj dane punktów do pliku w formacie CSV lub GeoJSON.', 
            side: "left" 
        },
        onHighlightStarted: () => {
            const btn = document.getElementById('selectAreaBtn');
            const accordionContent = btn.closest('.accordion-content');
            const accordionHeader = accordionContent.previousElementSibling;
            if (accordionContent.style.display !== "block") {
                accordionContent.style.display = "block";
                accordionHeader.classList.add('active');
            }
            document.querySelector('.layers-body').scrollTop = 1000;
        }
    },
    { 
        element: '.info.legend', 
        popover: { 
            title: 'Legenda', 
            description: 'Zwijana legenda objaśniająca dane prezentowane na mapie.', 
            side: "top" 
        } 
    },
    { 
        element: '#coordinatesPanel', 
        popover: { 
            title: 'Transformacja', 
            description: 'Panel wyświetlający aktualne współrzędne w układzie globalnym WGS84 oraz ich przelicznik na obowiązujący układ PL-2000.', 
            side: "top" 
        } 
    },
    { 
        element: '#faqBtn', 
        popover: { 
            title: 'Instrukcja obsługi', 
            description: 'Jeśli zapomnisz do czego służą poszczególne narzędzia, tutaj odnajdziesz najczęściej zadawane pytania.', 
            side: "right" 
        } 
    },
    { 
        element: '#tutorialBtn', 
        popover: { 
            title: 'Samouczek', 
            description: 'Ponowne uruchomienie samouczka obsługi aplikacji. Jeżeli chcesz w szybki sposób przypomnieć sobie wiedzę odnośnie obsługi aplikacji, możesz ponownie włączyć przygotowany przez nas tutorial.', 
            side: "right" 
        } 
    },
    { 
        element: '#bugBtn', 
        popover: { 
            title: 'Zgłaszanie błędów', 
            description: 'Napotkałeś problem? Skorzystaj z tego przycisku, aby wysłać zgłoszenie bezpośrednio do nas.', 
            side: "right" 
        } 
    },
    {
        popover: {
            title: 'Koniec samouczka',
            description: `To już wszystko, życzymy przyjemnego korzystania z aplikacji. W razie problemów panel pomocy jest do Twojej dyspozycji. Powodzenia!
            <div style="text-align: center; margin-top: 25px;">
                <img src="https://upload.wikimedia.org/wikipedia/commons/3/35/Znak_graficzny_AGH.svg" alt="Logo AGH" style="width: 50px; margin-bottom: 10px;">
                <div style="font-size: 9px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                    Kraków, 2026 r.
                </div>
            </div>`
        }
    }
];

const mobileSteps = [
    { 
        popover: { 
            title: 'Witaj w aplikacji!', 
            description: "Ten przewodnik pokaże Ci, jak korzystać z dostępnych narzędzi. Kliknij 'Dalej', aby rozpocząć." 
        } 
    },
    { 
        element: '.search-container', 
        popover: { 
            title: 'Wyszukiwanie', 
            description: 'Wpisz fragment numeru punktu. System wyświetli listę podpowiedzi, a po zatwierdzeniu automatycznie wyśrodkuje mapę i otworzy kartę informacyjną ze szczegółami.', 
            side: "bottom", 
            align: 'start' 
        } 
    },
    { 
        element: '#locateBtn', 
        popover: { 
            title: 'Nawigacja', 
            description: 'Najważniejsze narzędzie w terenie. Kliknij, by wyśrodkować mapę na module GPS Twojego smartfona.', 
            side: "right" 
        } 
    },
    { 
        element: '.leaflet-popup', 
        popover: { 
            title: 'Karta informacyjna punktu', 
            description: 'Przeanalizujmy atrybuty na przykładzie punktu 712511112230. Znajdziesz tu m.in. typ znaku (rurka hartowana), rodzaj stabilizacji (Naziemny), wysokość, współrzędne oraz klasę osnowy.', 
            side: "bottom", 
            align: 'start' 
        },
        onHighlightStarted: () => {
            document.getElementById('searchInput').value = '712511112230';
			window.searchPoint();
        }
    },
    { 
        element: '.topo-section:nth-of-type(1)', 
        popover: { 
            title: 'Opis topograficzny', 
            description: 'Tutaj możesz wyświetlić (lub pobrać) opis topograficzny w formacie PDF oraz JPG.', 
            side: "top" 
        },
        onHighlightStarted: () => {
            const popupBody = document.querySelector('.popup-body');
            const target = document.querySelectorAll('.topo-section')[0];
            if (popupBody && target) popupBody.scrollTop = target.offsetTop - 20;
        }
    },
    { 
        element: '.topo-section:nth-of-type(2)', 
        popover: { 
            title: 'Mapa porównania z terenem', 
            description: 'Narzędzie pozwala wyświetlić plik PDF z mapą porównania z terenem.', 
            side: "top" 
        },
        onHighlightStarted: () => {
            const popupBody = document.querySelector('.popup-body');
            const target = document.querySelectorAll('.topo-section')[1];
            if (popupBody && target) popupBody.scrollTop = target.offsetTop - 20;
        }
    },
    { 
        element: '.topo-section:nth-of-type(3)', 
        popover: { 
            title: 'Nawigacja do punktu', 
            description: 'Opcja wyjątkowo przydatna w terenie. Jednym kliknięciem uruchomisz trasę w aplikacjach Google Maps lub Apple Maps prosto do lokalizacji znaku.', 
            side: "top" 
        },
        onHighlightStarted: () => {
            const popupBody = document.querySelector('.popup-body');
            const target = document.querySelectorAll('.topo-section')[2];
            if (popupBody && target) popupBody.scrollTop = target.offsetTop - 20;
        }
    },
    { 
        element: '.section-raport', 
        popover: { 
            title: 'Metryczka punktu', 
            description: 'Funkcja ta pozwala na wygenerowanie automatycznego raportu odnośnie punktu osnowy w formacie PDF. Dane w raporcie tworzone są na podstawie danych opisowych znaku oraz opisu topograficznego.', 
            side: "top",
            align: 'start'
        },
        onHighlightStarted: () => {
            const target = document.querySelector('.section-raport');
            if (target) target.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
    },
    { 
        element: '#mobileLayersBtn', 
        popover: { 
            title: 'Panel Warstw', 
            description: 'Zarządzanie widokiem. Otwórz panel, aby przełączać podkłady mapowe, uruchamiać usługi WMS i dostosowywać wyświetlane warstwy.', 
            side: "right" 
        },
        onHighlightStarted: () => {
            map.closePopup();
            document.getElementById('layersPanel').classList.remove('mobile-active');
        }
    },
    { 
        element: '#selectAreaBtn', 
        popover: { 
            title: 'Eksport danych', 
            description: 'Narzędzie do pobierania danych. Zaznacz na mapie interesujący Cię obszar, a następnie wyeksportuj dane punktów do pliku w formacie CSV lub GeoJSON.', 
            side: "top" 
        },
        onHighlightStarted: () => {
            document.getElementById('layersPanel').classList.add('mobile-active');
            
            const btn = document.getElementById('selectAreaBtn');
            if (btn) {
                const content = btn.closest('.accordion-content');
                if (content) {
                    content.style.display = 'block';
                    if (content.previousElementSibling) content.previousElementSibling.classList.add('active');
                }
                const layersBody = document.querySelector('.layers-body');
                if (layersBody) layersBody.scrollTo({ top: btn.offsetTop - 60, behavior: 'smooth' });
            }
        }
    },
    { 
        element: '#measureBtn', 
        popover: { 
            title: 'Pomiary', 
            description: 'Uruchamia narzędzie pomiarowe pozwalające na wyznaczenie odległości i pola powierzchni.', 
            side: "right" 
        },
        onHighlightStarted: () => {
            document.getElementById('layersPanel').classList.remove('mobile-active');
        }
    },
    { 
        element: '.info.legend', 
        popover: { 
            title: 'Legenda', 
            description: 'Dotknij nagłówka legendy, aby ją rozwinąć.', 
            side: "top" 
        } 
    },
    { 
        element: '#coordinatesPanel', 
        popover: { 
            title: 'Transformacja', 
            description: 'Panel wyświetlający aktualne współrzędne w układzie globalnym WGS84 oraz ich przelicznik na obowiązujący układ PL-2000.', 
            side: "top" 
        } 
    },
    { 
        element: '#faqBtn', 
        popover: { 
            title: 'Pomoc', 
            description: 'Skrócona instrukcja obsługi narzędzi aplikacji jest dostępna zawsze pod tym przyciskiem.', 
            side: "right" 
        } 
    },
    { 
        element: '#tutorialBtn', 
        popover: { 
            title: 'Samouczek', 
            description: 'Ponowne uruchomienie samouczka obsługi aplikacji. Jeżeli chcesz w szybki sposób przypomnieć sobie wiedzę odnośnie obsługi aplikacji, możesz ponownie włączyć przygotowany przez nas tutorial.', 
            side: "right" 
        } 
    },
    { 
        element: '#bugBtn', 
        popover: { 
            title: 'Zgłaszanie błędów', 
            description: 'Napotkałeś problem? Skorzystaj z tego przycisku, aby wysłać zgłoszenie bezpośrednio do nas.', 
            side: "right" 
        } 
    },
    {
        popover: {
            title: 'Koniec samouczka',
            description: `To już wszystko, życzymy przyjemnego korzystania z aplikacji. W razie problemów panel pomocy jest do Twojej dyspozycji. Powodzenia!
            <div style="text-align: center; margin-top: 25px;">
                <img src="https://upload.wikimedia.org/wikipedia/commons/3/35/Znak_graficzny_AGH.svg" alt="Logo AGH" style="width: 50px; margin-bottom: 10px;">
                <div style="font-size: 9px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                    Kraków, 2026 r.
                </div>
            </div>`
        }
    }
];

export function initTutorial(map) {
    function startTutorial() {
        const isMobileView = window.innerWidth <= 950 || window.innerHeight <= 550;
        const initialCenter = map.getCenter();
        const initialZoom = map.getZoom();
        
        const driverObj = driver({
            ...driverConfig,
            steps: isMobileView ? mobileSteps : desktopSteps,
            onDestroyed: () => {
                map.closePopup();
                map.setView(initialCenter, initialZoom);
                document.getElementById('searchInput').value = '';
            }
        });
        driverObj.drive();
    }

    const tutorialBtn = document.getElementById('tutorialBtn');
    if (tutorialBtn) {
        tutorialBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startTutorial();
        });
    }

    const welcomeModal = document.getElementById('welcomeModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const startTutorialFromModalBtn = document.getElementById('startTutorialFromModalBtn');
    
    if (!sessionStorage.getItem('welcomeModalSeen') && welcomeModal) {
        welcomeModal.style.display = 'flex';
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            welcomeModal.style.display = 'none';
            sessionStorage.setItem('welcomeModalSeen', 'true');
        });
    }

    if (startTutorialFromModalBtn) {
        startTutorialFromModalBtn.addEventListener('click', () => {
            welcomeModal.style.display = 'none';
            sessionStorage.setItem('welcomeModalSeen', 'true');
            startTutorial();
        });
    }
}