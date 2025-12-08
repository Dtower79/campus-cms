/* ==========================================================================
   AUTH.JS (v49.0 - FINAL STABLE & PROFESSIONAL MODALS)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Detección de Parámetros URL
    const urlParams = new URLSearchParams(window.location.search);
    const resetCode = urlParams.get('code');
    const slugDestino = urlParams.get('slug');

    const views = {
        login: document.getElementById('login-view'),
        register: document.getElementById('register-view'),
        forgot: document.getElementById('forgot-view'),
        reset: document.getElementById('reset-view')
    };

    function switchView(viewName) {
        Object.values(views).forEach(el => el.style.display = 'none');
        if(views[viewName]) views[viewName].style.display = 'block';
        document.getElementById('login-error-msg').style.display = 'none';
    }

    if (resetCode) {
        switchView('reset');
        document.getElementById('reset-code').value = resetCode;
    } 
    else if (slugDestino && !localStorage.getItem('jwt')) {
        const loginHeader = document.querySelector('.login-header');
        if(loginHeader && !document.querySelector('.alert-info-lock')) {
            const aviso = document.createElement('div');
            aviso.className = 'alert-info alert-info-lock';
            aviso.style.marginTop = '15px'; aviso.style.fontSize = '0.9rem'; aviso.style.backgroundColor = '#e3f2fd'; aviso.style.color = '#0d47a1'; aviso.style.border = '1px solid #bbdefb';
            aviso.innerHTML = '<i class="fa-solid fa-lock"></i> <strong>Contingut Protegit:</strong><br>Inicia la sessió per accedir directament al curs.';
            loginHeader.appendChild(aviso);
        }
    }

    document.getElementById('btn-show-register')?.addEventListener('click', (e) => { e.preventDefault(); switchView('register'); });
    document.getElementById('btn-forgot-pass')?.addEventListener('click', (e) => { e.preventDefault(); switchView('forgot'); });
    document.querySelectorAll('.btn-back-login').forEach(btn => {
        btn.addEventListener('click', (e) => { e.preventDefault(); switchView('login'); });
    });

    // --- HELPER MODAL MEJORADO (Admite callback) ---
    function lanzarModal(titulo, mensaje, esError = true, callback = null) {
        const modal = document.getElementById('custom-modal');
        document.getElementById('modal-title').innerText = titulo; 
        document.getElementById('modal-title').style.color = esError ? "var(--brand-red)" : "var(--brand-blue)"; 
        document.getElementById('modal-msg').innerHTML = mensaje; 
        document.getElementById('modal-btn-cancel').style.display = 'none'; 
        
        const btn = document.getElementById('modal-btn-confirm');
        btn.innerText = "Entesos"; 
        btn.style.background = esError ? "var(--brand-red)" : "var(--brand-blue)";
        
        // Clonamos para limpiar eventos anteriores
        const newBtn = btn.cloneNode(true); 
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.onclick = () => {
            modal.style.display = 'none';
            if (callback) callback(); // Ejecutar acción al cerrar (ej: redirigir)
        };
        
        modal.style.display = 'flex';
    }

    // 1. LOGIN
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dni = document.getElementById('login-dni').value.trim().toUpperCase();
            const pass = document.getElementById('login-pass').value.trim();
            const btnSubmit = loginForm.querySelector('button[type="submit"]');

            if (!dni || !pass) return lanzarModal("Error", "Camps buits.");
            btnSubmit.innerText = "Connectant..."; btnSubmit.disabled = true;

            try {
                const res = await fetch(API_ROUTES.login, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier: dni, password: pass })
                });
                const data = await res.json();
                if (res.ok && data.jwt) {
                    localStorage.setItem('jwt', data.jwt);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.reload(); 
                } else {
                    lanzarModal("Error d'Accés", "DNI o contrasenya incorrectes.");
                }
            } catch (error) {
                lanzarModal("Error de Connexió", "No s'ha pogut connectar amb el servidor.");
            } finally {
                btnSubmit.innerText = "Inicia la sessió"; btnSubmit.disabled = false;
            }
        });
    }

    // 2. REGISTRO
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dni = document.getElementById('reg-dni').value.trim().toUpperCase();
            const pass = document.getElementById('reg-pass').value;
            const passConf = document.getElementById('reg-pass-conf').value;
            const btnSubmit = registerForm.querySelector('button[type="submit"]');

            if(pass !== passConf) return lanzarModal("Error", "Les contrasenyes no coincideixen.");
            
            btnSubmit.innerText = "Verificant..."; btnSubmit.disabled = true;

            try {
                const resAfi = await fetch(`${API_ROUTES.checkAffiliate}?filters[dni][$eq]=${dni}`);
                const jsonAfi = await resAfi.json();
                
                if(!jsonAfi.data || jsonAfi.data.length === 0) {
                     lanzarModal("DNI no autoritzat", "No constes com a afiliat actiu.");
                     btnSubmit.innerText = "Validar i Entrar"; btnSubmit.disabled = false;
                     return;
                }

                const afiliado = jsonAfi.data[0];
                const emailAfiliado = afiliado.email; 

                if (!emailAfiliado) {
                    lanzarModal("Error de Dades", "Ets afiliat però no tenim el teu email registrat. Contacta amb secretaria.");
                    btnSubmit.innerText = "Validar i Entrar"; btnSubmit.disabled = false;
                    return;
                }

                const regRes = await fetch(API_ROUTES.register, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        username: dni, 
                        email: emailAfiliado, 
                        password: pass,
                        nombre: afiliado.nombre || "", 
                        apellidos: afiliado.apellidos || ""
                    })
                });
                const regData = await regRes.json();

                if(regRes.ok) {
                    try {
                        if (regData.jwt) {
                            await fetch(API_ROUTES.notifications, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${regData.jwt}` },
                                body: JSON.stringify({
                                    data: {
                                        titol: "Benvingut al Campus! 👋",
                                        missatge: "Compte activat correctament.",
                                        llegida: false,
                                        users_permissions_user: regData.user.id
                                    }
                                })
                            });
                        }
                    } catch(err) {}

                    // ÉXITO REGISTRO -> Modal profesional
                    lanzarModal(
                        "Compte Creat!", 
                        `Hem trobat el teu email d'afiliat: <strong>${emailAfiliado}</strong>.<br>Ja pots iniciar sessió.`, 
                        false,
                        () => window.location.reload()
                    );
                } else {
                    let errorMsg = regData.error?.message || "Error al crear compte.";
                    if(errorMsg.includes('username')) errorMsg = "Aquest DNI ja està registrat.";
                    if(errorMsg.includes('email')) errorMsg = "El teu email d'afiliat ja està en ús per un altre usuari.";
                    
                    lanzarModal("Error", errorMsg);
                    btnSubmit.innerText = "Validar i Entrar"; btnSubmit.disabled = false;
                }
            } catch(e) { 
                console.error(e);
                lanzarModal("Error", "Error de connexió."); 
                btnSubmit.innerText = "Validar i Entrar"; btnSubmit.disabled = false;
            }
        });
    }

    // 3. RECUPERACIÓN
    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const inputDni = document.getElementById('forgot-dni');
            const btnSubmit = forgotForm.querySelector('button');
            
            let dniLimpio = inputDni.value.trim().toUpperCase().replace(/[- \/\.]/g, '');
            const dniRegex = /^\d{8}[A-Z]$/;

            if (!dniRegex.test(dniLimpio)) {
                lanzarModal("Format Incorrecte", "El DNI ha de tenir 8 números i una lletra (Ex: 12345678Z).");
                return;
            }

            btnSubmit.innerText = "Cercant..."; btnSubmit.disabled = true;

            try {
                const resAfi = await fetch(`${API_ROUTES.checkAffiliate}?filters[dni][$eq]=${dniLimpio}`);
                const jsonAfi = await resAfi.json();

                let emailDestino = "";
                if(jsonAfi.data && jsonAfi.data.length > 0) {
                    const afi = jsonAfi.data[0];
                    emailDestino = afi.email || afi.Email; 
                }

                if (!emailDestino) {
                    lanzarModal("Informació", "Si el DNI és correcte i té un email associat, rebràs un correu en breus moments.");
                    switchView('login');
                    return;
                }

                await fetch(API_ROUTES.forgotPassword, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailDestino })
                });
                
                const maskedEmail = emailDestino.replace(/(.{2})(.*)(@.*)/, "$1***$3");
                lanzarModal("Correu Enviat", `Hem enviat un enllaç de recuperació a: <strong>${maskedEmail}</strong>.<br>Revisa la carpeta Spam.`, false);
                switchView('login');

            } catch (error) {
                console.error(error);
                lanzarModal("Error", "No s'ha pogut processar la sol·licitud.");
            } finally {
                btnSubmit.innerText = "Enviar Enllaç"; btnSubmit.disabled = false;
            }
        });
    }

    // 4. RESET PASSWORD (AQUÍ ESTÁ LA MAGIA)
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('reset-code').value;
            const pass = document.getElementById('reset-pass').value;
            const passConf = document.getElementById('reset-pass-conf').value;
            const btnSubmit = resetForm.querySelector('button');

            if (pass !== passConf) return lanzarModal("Error", "Les contrasenyes no coincideixen.");

            btnSubmit.innerText = "Canviant..."; btnSubmit.disabled = true;

            try {
                const res = await fetch(API_ROUTES.resetPassword, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: code,
                        password: pass,
                        passwordConfirmation: passConf
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    localStorage.setItem('jwt', data.jwt);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    // MODAL BONITO
                    lanzarModal(
                        "Contrasenya Canviada", 
                        "La teva contrasenya s'ha actualitzat correctament. Iniciant sessió...", 
                        false, // Color azul
                        () => {
                            // Redirigir limpio al Dashboard
                            window.location.href = window.location.pathname.split('?')[0];
                        }
                    );
                } else {
                    lanzarModal("Error", "L'enllaç ha caducat o ja s'ha utilitzat.");
                }
            } catch (error) {
                lanzarModal("Error", "Error de connexió.");
            } finally {
                btnSubmit.innerText = "Guardar Canvis"; btnSubmit.disabled = false;
            }
        });
    }
});