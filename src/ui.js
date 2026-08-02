export function initUI() {
    // --- OBSŁUGA MOTYWU ---
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const moonIcon = document.getElementById('moonIcon');
    const sunIcon = document.getElementById('sunIcon');

    const currentTheme = localStorage.getItem('theme') || 
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if(moonIcon) moonIcon.style.display = 'none';
        if(sunIcon) sunIcon.style.display = 'block';
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.body.classList.toggle('dark-mode');
            let theme = 'light';
            
            if (document.body.classList.contains('dark-mode')) {
                theme = 'dark';
                moonIcon.style.display = 'none';
                sunIcon.style.display = 'block';
            } else {
                moonIcon.style.display = 'block';
                sunIcon.style.display = 'none';
            }
            localStorage.setItem('theme', theme);
        });
    }

    // --- OBSŁUGA FAQ ---
    const faqModal = document.getElementById('faqModal');
    const faqBtn = document.getElementById('faqBtn');
    const closeFaqBtn = document.getElementById('closeFaqBtn');
    const closeFaqIcon = document.getElementById('closeFaqIcon');

    if (faqBtn) {
        faqBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            faqModal.style.display = 'flex';
        });
    }

    if (closeFaqBtn) closeFaqBtn.addEventListener('click', () => faqModal.style.display = 'none');
    if (closeFaqIcon) closeFaqIcon.addEventListener('click', () => faqModal.style.display = 'none');

    faqModal?.addEventListener('click', (e) => {
        if (e.target === faqModal) faqModal.style.display = 'none';
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && faqModal?.style.display === 'flex') faqModal.style.display = 'none';
    });

    // --- OBSŁUGA ZGŁASZANIA BŁĘDÓW ---
    const bugModal = document.getElementById('bugModal');
    const bugBtn = document.getElementById('bugBtn');
    const closeBugIcon = document.getElementById('closeBugIcon');
    const bugForm = document.querySelector('#bugModal form');

    if (bugBtn) {
        bugBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            bugModal.style.display = 'flex';
        });
    }

    if (closeBugIcon) closeBugIcon.addEventListener('click', () => bugModal.style.display = 'none');

    bugModal?.addEventListener('click', (e) => {
        if (e.target === bugModal) bugModal.style.display = 'none';
    });

    if (bugForm) {
        bugForm.addEventListener('submit', function(e) {
            e.preventDefault(); 
            const hCaptchaResponse = bugForm.querySelector('textarea[name=h-captcha-response]');
            if (!hCaptchaResponse || !hCaptchaResponse.value) {
                alert("Proszę potwierdzić, że nie jesteś robotem (Captcha).");
                return;
            }

            const submitBtn = document.getElementById('sendBugBtn');
            const originalText = submitBtn.innerText;
            
            submitBtn.innerText = 'Wysyłanie...';
            submitBtn.disabled = true;

            const formData = new FormData(this);

            fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                body: formData
            })
            .then(response => {
                if (!response.ok) throw new Error('Błąd serwera formularzy');
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    bugModal.style.display = 'none';
                    document.getElementById('bugDescription').value = '';
                    document.getElementById('bugReporter').value = '';
                } else {
                    alert("Wystąpił problem z wysłaniem zgłoszenia.");
                }
            })
            .catch(error => {
                console.error('Błąd wysyłania:', error);
                alert("Błąd połączenia. Zgłoszenie nie zostało wysłane. Sprawdź, czy Twój AdBlock nie blokuje formularza.");
            })
            .finally(() => {
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            });
        });
    }
}