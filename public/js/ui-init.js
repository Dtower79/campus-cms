/* js/ui-init.js */

// 1. Aplicar tema inmediatamente para evitar parpadeo blanco
const savedTheme = localStorage.getItem('theme');
if(savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);

    // 2. Router: Lógica de vista si hay slug
    if (urlParams.get('slug')) { 
        const dv = document.getElementById('dashboard-view');
        const ev = document.getElementById('exam-view');
        if(dv) dv.style.display = 'none'; 
        if(ev) ev.style.display = 'flex'; 
    }

    // 3. Lógica del botón de tema (Sol/Luna)
    const themeBtn = document.getElementById('theme-toggle'); 
    if (themeBtn) {
        const icon = themeBtn.querySelector('i');
        icon.className = localStorage.getItem('theme') === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        
        themeBtn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const next = isDark ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next); 
            localStorage.setItem('theme', next);
            icon.className = next === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        });
    }

    // 4. Lógica para los OJOS (Ver contraseña)
    const setupEye = (eyeId, inputId) => {
        const eye = document.getElementById(eyeId);
        if (eye) {
            eye.onclick = () => {
                // Usamos la función que ya existe en auth.js
                if (typeof window.togglePasswordVisibility === 'function') {
                    window.togglePasswordVisibility(inputId, eye);
                }
            };
        }
    };
    setupEye('eye-login', 'login-pass');
    setupEye('eye-reset-1', 'reset-pass');
    setupEye('eye-reset-2', 'reset-pass-conf');

    // 5. Lógica para abrir MODALES LEGALES (Footer)
    const setupLegalModal = (btnId, modalId) => {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        if (btn && modal) {
            btn.onclick = (e) => {
                e.preventDefault();
                modal.style.display = 'flex';
            };
        }
    };
    setupLegalModal('btn-footer-avis', 'modal-avis');
    setupLegalModal('btn-footer-privacitat', 'modal-privacitat');
    setupLegalModal('btn-footer-cookies', 'modal-cookies');

    // 6. Lógica para CERRAR MODALES (Botón Tancar)
    const setupClose = (btnId, modalId) => {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        if (btn && modal) {
            btn.onclick = () => { modal.style.display = 'none'; };
        }
    };
    setupClose('btn-close-avis', 'modal-avis');
    setupClose('btn-close-privacitat', 'modal-privacitat');
    setupClose('btn-close-cookies', 'modal-cookies');
});