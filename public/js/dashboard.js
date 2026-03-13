/* ==========================================================================
   DASHBOARD.JS (v56.8 - SIGNATURE POSITION FIX)
   ========================================================================== */
if (new URLSearchParams(window.location.search).has('code')) {
    console.log("🛑 Bloqueo preventivo activado: Esperando reset de contraseña.");
    throw new Error("Reset en curso"); // Esto detiene la ejecución del script
}
console.log("🚀 Carregant Dashboard v56.8...");

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.has('code')) return;
    

    const token = localStorage.getItem('jwt');
    const loginOverlay = document.getElementById('login-overlay');
    const appContainer = document.getElementById('app-container');
    const loginView = document.getElementById('login-view');

    if (!token) return; 

    if(loginView) loginView.style.display = 'none';
    const loginCard = document.querySelector('.login-card');
    let spinner = document.createElement('div');
    spinner.id = 'auth-loader';
    spinner.className = 'loader'; 
    spinner.style.margin = '20px auto';
    if(loginCard) loginCard.appendChild(spinner);

    try {
        const res = await fetch(`${STRAPI_URL}/api/users/me?populate=*`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const freshUser = await res.json();
            localStorage.setItem('user', JSON.stringify(freshUser));

            if(spinner) spinner.remove();
            loginOverlay.style.display = 'none';
            appContainer.style.display = 'block';
            
            console.log("✅ Usuari validat");
            if (!window.appIniciada) window.iniciarApp();
        } else {
            throw new Error('Token caducado');
        }

    } catch (error) {
        console.warn("Sessió caducada.");
        localStorage.clear(); 
        if(spinner) spinner.remove();
        if(loginView) loginView.style.display = 'block';
    }

    const scrollBtn = document.getElementById('scroll-top-btn');
    if(scrollBtn) {
        window.onscroll = () => { scrollBtn.style.display = (document.documentElement.scrollTop > 300) ? "flex" : "none"; };
        scrollBtn.onclick = () => window.scrollTo({top:0, behavior:'smooth'});
    }
});

window.appIniciada = false;
window.sesionLeidas = new Set(); 

window.iniciarApp = async function() {
    window.appIniciada = true;
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if(user) {
        const safeText = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = txt; };

        // 1. Cargamos datos básicos inmediatos (evita ver placeholders o puntos)
        safeText('dropdown-email', user.email);
        safeText('profile-dni-display', user.username);
        safeText('dropdown-username', user.username);
        safeText('user-initials', user.username.substring(0, 2).toUpperCase());

        try {
            // 2. Buscamos en la tabla afiliados usando el DNI (username) para obtener el nombre real
            const resAfi = await fetch(`${STRAPI_URL}/api/afiliados?filters[dni][$eq]=${user.username}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const jsonAfi = await resAfi.json();
            
            if (jsonAfi.data && jsonAfi.data.length > 0) {
                const afi = jsonAfi.data[0];
                const nombreReal = `${afi.nombre} ${afi.apellidos}`;
                localStorage.setItem('user_fullname', nombreReal); // Guardamos para diplomas y dudas
                
                let initials = afi.nombre.charAt(0) + (afi.apellidos ? afi.apellidos.charAt(0) : "");
                
                // Actualizamos la UI con el nombre real e iniciales correctas
                safeText('dropdown-username', nombreReal);
                safeText('user-initials', initials.toUpperCase());
                safeText('profile-name-display', nombreReal);
                safeText('profile-avatar-big', initials.toUpperCase());
            }
        } catch (e) { 
            console.error("Error recuperando nombre real:", e); 
        }
    }

    setupDirectClicks();
    checkRealNotifications();

    // 3. Control de redirección por Slug
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');

    if (!slug) {
        window.showView('home'); 
    } else {
        // Verificamos acceso al curso específico si hay un slug en la URL
        fetch(`${STRAPI_URL}/api/cursos?filters[slug][$eq]=${slug}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(json => {
            if (!json.data || json.data.length === 0) throw new Error("Curs no trobat");
            
            const curs = json.data[0];
            const hoy = new Date();
            const rawInicio = curs.data_inici || curs.fecha_inicio || curs.publishedAt;
            const fechaInicio = new Date(rawInicio);
            const esFuturo = fechaInicio > hoy;
            const esProfe = user.es_professor === true;

            if (esFuturo && !esProfe) {
                // SI ES FUTURO Y NO ES PROFE: Redirigimos al catálogo con aviso
                const dateStr = fechaInicio.toLocaleDateString('ca-ES');
                window.location.href = 'index.html'; 
                alert(`Aquest curs encara no ha començat. Data d'inici: ${dateStr}`);
            } else {
                // SI TODO ES CORRECTO: Mostramos la vista de examen/curso
                document.getElementById('dashboard-view').style.display = 'none';
                document.getElementById('exam-view').style.display = 'flex';
            }
        })
        .catch(err => {
            console.error("Error validant accés:", err);
            window.location.href = 'index.html';
        });
    }
};

window.showView = function(viewName) {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => { const t = iframe.src; iframe.src = ''; iframe.src = t; });
    const html5Videos = document.querySelectorAll('video');
    html5Videos.forEach(video => { video.pause(); });

    ['catalog-view', 'dashboard-view', 'profile-view', 'grades-view', 'exam-view'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });

    const map = { 'home': 'catalog-view', 'dashboard': 'dashboard-view', 'profile': 'profile-view', 'grades': 'grades-view', 'exam': 'exam-view' };
    const target = document.getElementById(map[viewName]);
    if(target) target.style.display = viewName === 'exam' ? 'flex' : 'block';

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    if(viewName === 'home') document.getElementById('nav-catalog')?.classList.add('active');
    if(viewName === 'dashboard') document.getElementById('nav-dashboard')?.classList.add('active');
    if(viewName === 'profile') document.getElementById('nav-profile')?.classList.add('active');

    if(viewName === 'dashboard') loadUserCourses();
    if(viewName === 'home') loadCatalog();
    if(viewName === 'profile') loadFullProfile();
    if(viewName === 'grades') loadGrades();
};

function setupDirectClicks() {
    document.getElementById('btn-notifs').onclick = (e) => { e.stopPropagation(); abrirPanelNotificaciones(); };
    document.getElementById('btn-messages').onclick = (e) => { e.stopPropagation(); abrirPanelMensajes(); };
    
    const navs = {'nav-catalog': 'home', 'nav-profile': 'profile', 'nav-dashboard': 'dashboard'};
    for(const [id, view] of Object.entries(navs)) {
        const el = document.getElementById(id);
        if(el) el.onclick = (e) => { e.preventDefault(); window.showView(view); };
    }

    const btnUser = document.getElementById('user-menu-trigger');
    const userDropdown = document.getElementById('user-dropdown-menu');

    if (btnUser && userDropdown) {
        btnUser.onclick = (e) => {
            e.stopPropagation();
            const isVisible = userDropdown.style.display === 'flex';
            userDropdown.style.display = isVisible ? 'none' : 'flex';
            if (isVisible) userDropdown.classList.remove('show');
            else userDropdown.classList.add('show');
        };
        document.addEventListener('click', () => {
            userDropdown.style.display = 'none';
            userDropdown.classList.remove('show');
        });
        userDropdown.onclick = (e) => e.stopPropagation();

        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.onclick = (e) => { 
                e.preventDefault(); 
                userDropdown.style.display = 'none';
                window.showView(btn.getAttribute('data-action')); 
            };
        });
        
        const btnLogout = document.getElementById('btn-logout-dropdown');
        if(btnLogout) btnLogout.onclick = (e) => { 
            e.preventDefault(); 
            localStorage.clear(); 
            window.location.href = 'index.html'; 
        };
    }

    const btnMob = document.getElementById('mobile-menu-btn');
    const navMob = document.getElementById('main-nav');
    if(btnMob) btnMob.onclick = (e) => { e.stopPropagation(); navMob.classList.toggle('show-mobile'); };
}

// --- NOTIFICACIONES ---
async function checkRealNotifications() {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');
    const bellDot = document.querySelector('.notification-dot');
    if(!user || !token) return;

    try {
        let total = 0;
        const ts = new Date().getTime();
        
        const res = await fetch(`${API_ROUTES.notifications}?filters[users_permissions_user][id][$eq]=${user.id}&filters[llegida][$eq]=false&_t=${ts}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        const validNotifs = (json.data || []).filter(n => !window.sesionLeidas.has(n.documentId || n.id));
        total += validNotifs.length;

        if(user.es_professor === true) {
            const resMsg = await fetch(`${API_ROUTES.messages}?filters[estat][$eq]=pendent&_t=${ts}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const jsonMsg = await resMsg.json();
            const validMsgs = (jsonMsg.data || []).filter(m => !window.sesionLeidas.has(m.documentId || m.id));
            total += validMsgs.length;
        }

        if(bellDot) {
            if(total > 0) {
                bellDot.style.display = 'flex';
                bellDot.innerText = total > 9 ? '+9' : total;
                bellDot.classList.add('animate-ping');
            } else {
                bellDot.style.display = 'none';
                bellDot.classList.remove('animate-ping');
            }
        }
    } catch(e) { console.warn(e); }
}

window.abrirPanelNotificaciones = async function() {
    const modal = document.getElementById('custom-modal');
    const msg = document.getElementById('modal-msg');
    const btnC = document.getElementById('modal-btn-confirm');
    document.getElementById('modal-title').innerText = "Notificacions";
    document.getElementById('modal-title').style.color = "var(--brand-blue)";
    document.getElementById('modal-btn-cancel').style.display = 'none';
    btnC.innerText = "Tancar";
    
    btnC.disabled = false;
    btnC.onclick = () => modal.style.display = 'none';
    
    msg.innerHTML = '<div class="loader"></div>';
    modal.style.display = 'flex';

    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');

    try {
        let html = '<div class="notif-list">';
        let hasContent = false;
        const ts = new Date().getTime();

        if(user.es_professor === true) {
             const resMsg = await fetch(`${API_ROUTES.messages}?filters[estat][$eq]=pendent&_t=${ts}`, { headers: { 'Authorization': `Bearer ${token}` } });
             const jsonMsg = await resMsg.json();
             const pendientesReales = (jsonMsg.data || []).filter(m => !window.sesionLeidas.has(m.documentId || m.id));
             
             if(pendientesReales.length > 0) {
                 hasContent = true;
                 html += `<div class="notif-item unread" onclick="openTeacherInbox(this)">
                            <strong style="color:var(--brand-red)">👨‍🏫 Safata Professor</strong>
                            <p>Tens ${pendientesReales.length} dubtes d'alumnes per respondre.</p>
                          </div>`;
             }
        }

        const res = await fetch(`${API_ROUTES.notifications}?filters[users_permissions_user][id][$eq]=${user.id}&filters[llegida][$eq]=false&sort=createdAt:desc&_t=${ts}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await res.json();
        const notifsReales = (json.data || []).filter(n => !window.sesionLeidas.has(n.documentId || n.id));

        if(notifsReales.length > 0) {
            hasContent = true;
            notifsReales.forEach(n => {
                const idReal = n.documentId || n.id;
                html += `<div class="notif-item unread" onclick="marcarLeida('${idReal}', this)">
                            <strong style="color:var(--brand-blue)">${n.titol}</strong><p>${n.missatge}</p>
                         </div>`;
            });
        }

        html += '</div>';
        if(!hasContent) msg.innerHTML = '<div style="text-align:center; padding:30px; color:#999;"><p>No tens notificacions noves.</p></div>';
        else msg.innerHTML = html;

    } catch(e) { msg.innerHTML = 'Error al carregar.'; }
};

window.marcarLeida = async function(id, el) {
    el.style.opacity = '0.5';
    el.style.pointerEvents = 'none';
    window.sesionLeidas.add(id);

    const token = localStorage.getItem('jwt');
    try {
        const res = await fetch(`${API_ROUTES.notifications}/${id}`, {
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
            body: JSON.stringify({ data: { llegida: true } }) 
        });
        if(!res.ok) throw new Error("API Error");
        el.remove();
        
        const bellDot = document.querySelector('.notification-dot');
        if(bellDot) {
            let count = parseInt(bellDot.innerText) || 0;
            count = Math.max(0, count - 1);
            if(count === 0) bellDot.style.display = 'none';
            else bellDot.innerText = count > 9 ? '+9' : count;
        }
    } catch(e) { console.error(e); }
};

window.openTeacherInbox = function(element) {
    element.style.display = 'none';
    document.getElementById('custom-modal').style.display = 'none';
    abrirPanelMensajes('profesor');
};

// --- MENSAJERÍA / CHAT ---
window.abrirPanelMensajes = async function(modoForzado, filtroHistorial = false) {
    const modal = document.getElementById('custom-modal');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-msg');
    const btnC = document.getElementById('modal-btn-confirm');
    document.getElementById('modal-btn-cancel').style.display = 'none';

    const user = JSON.parse(localStorage.getItem('user'));
    const esProfe = user.es_professor === true;
    let modoActual = modoForzado ? modoForzado : (esProfe ? 'profesor' : 'alumno');

    // UI de la Capçalera amb botons de control per al professor
    if (esProfe) {
        let botonesExtra = '';
        if (modoActual === 'profesor') {
            botonesExtra = `
                <button class="btn-small" onclick="abrirPanelMensajes('profesor', ${!filtroHistorial})" style="font-size:0.7rem; padding:4px 8px; background:${filtroHistorial ? 'var(--brand-blue)' : '#666'}">
                    ${filtroHistorial ? 'Veure Pendents' : 'Veure Historial'}
                </button>
            `;
        }

        titleEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:10px;">
                <span style="font-size:1.1rem;">${modoActual === 'profesor' ? (filtroHistorial ? '📚 Historial' : '👨‍🏫 Bústia Professor') : '💬 Els meus Dubtes'}</span>
                <div style="display:flex; gap:5px;">
                    ${botonesExtra}
                    <button class="btn-small" onclick="abrirPanelMensajes('${modoActual === 'profesor' ? 'alumno' : 'profesor'}')" style="font-size:0.7rem; padding:4px 8px; opacity:0.8;">
                        ${modoActual === 'profesor' ? 'Vista Alumne' : 'Vista Profe'}
                    </button>
                </div>
            </div>`;
    } else {
        titleEl.innerText = "💬 Els meus Dubtes";
        titleEl.style.color = "var(--brand-blue)";
    }

    btnC.innerText = "Tancar";
    btnC.onclick = () => modal.style.display = 'none';
    msgEl.innerHTML = '<div class="loader"></div>';
    modal.style.display = 'flex';
    
    const token = localStorage.getItem('jwt');

    try {
        let endpoint = '';
        const ts = new Date().getTime();
        
        if (modoActual === 'profesor') {
            // Si historial és true, busquem els 'respost', si no, els 'pendent'
            const estatCerca = filtroHistorial ? 'respost' : 'pendent';
            endpoint = `${API_ROUTES.messages}?filters[estat][$eq]=${estatCerca}&sort=updatedAt:desc&populate=*&_t=${ts}`;
        } else {
            endpoint = `${API_ROUTES.messages}?filters[users_permissions_user][id][$eq]=${user.id}&sort=createdAt:asc&populate=*&_t=${ts}`;
        }

        const respuestaAPI = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${token}` } });
        const jsonM = await respuestaAPI.json();
        
        if(!jsonM.data || jsonM.data.length === 0) {
            msgEl.innerHTML = `<div style="text-align:center; padding:40px 20px; color:#999;"><h4>No hi ha missatges ${filtroHistorial ? 'a l\'historial' : 'pendents'}</h4></div>`;
        } else {
            let html = '<div class="msg-list-container" id="chat-container">';
            
            jsonM.data.forEach(m => {
                const dataM = m.attributes ? m.attributes : m;
                const msgId = m.documentId || m.id;
                const dateUser = new Date(dataM.createdAt).toLocaleDateString('ca-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
                const dateProfe = new Date(dataM.updatedAt).toLocaleDateString('ca-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
                const headerBadge = `<strong>${dataM.curs}</strong> | ${dataM.tema}`;
                
                if (modoActual === 'profesor') {
                    const alumnoNombre = dataM.alumne_nom || 'Alumne';
                    const alumnoId = dataM.users_permissions_user?.id || dataM.users_permissions_user?.data?.id;
                    const temaEnc = encodeURIComponent(dataM.tema || 'Dubte').replace(/'/g, "%27");

                    html += `
                        <div class="msg-card" id="msg-card-${msgId}" style="border-left: 4px solid ${filtroHistorial ? '#10b981' : '#f59e0b'}">
                            <div class="msg-course-badge">${headerBadge}</div>
                            <div class="msg-content">
                                <div class="chat-bubble bubble-student">
                                    <strong>👤 ${alumnoNombre}</strong><br>
                                    ${dataM.missatge}
                                    <span class="msg-date-small">${dateUser}</span>
                                </div>
                                
                                ${filtroHistorial ? `
                                    <div class="chat-bubble bubble-teacher" style="margin-top:10px; background:#e8f5e9;">
                                        <strong style="color:#2e7d32">Tu has respost:</strong><br>
                                        ${dataM.resposta_professor}
                                        <span class="msg-date-small">${dateProfe}</span>
                                    </div>
                                ` : `
                                    <div class="reply-area">
                                        <textarea id="reply-${msgId}" class="modal-textarea" placeholder="Escriu la resposta..." style="height:80px;"></textarea>
                                        <button class="btn-primary" style="margin-top:5px; padding:5px 15px; font-size:0.85rem;" 
                                            onclick="window.enviarRespostaProfessor(this, '${msgId}', '${alumnoId}', '${temaEnc}')">
                                            Enviar Resposta
                                        </button>
                                    </div>
                                `}
                            </div>
                        </div>`;
                } else {
                    // Vista alumne (igual que abans)
                    html += `
                        <div class="msg-card">
                            <div class="msg-course-badge">${headerBadge}</div>
                            <div class="msg-content">
                                <div class="chat-bubble bubble-teacher">${dataM.missatge}<span class="msg-date-small">${dateUser}</span></div>
                                ${dataM.resposta_professor ? `
                                    <div class="chat-bubble bubble-student">
                                        <strong style="color:var(--brand-blue)">👨‍🏫 Professor:</strong><br>
                                        ${dataM.resposta_professor}
                                        <span class="msg-date-small" style="margin-top:5px;">${dateProfe}</span>
                                    </div>` : 
                                    '<small style="text-align:right; color:#999; font-size:0.75rem;">Esperant resposta...</small>'
                                }
                            </div>
                        </div>`;
                }
            });
            html += '</div>';
            msgEl.innerHTML = html;
            requestAnimationFrame(() => {
                const c = document.getElementById('chat-container');
                if(c) { c.scrollTop = 0; } // A l'historial millor començar per dalt
            });
        }
    } catch(e) { 
        console.error(e);
        msgEl.innerHTML = '<p style="color:red; text-align:center;">Error carregant missatges.</p>'; 
    }
};

window.enviarRespostaProfessor = async function(btnElement, msgId, studentId, encodedTema) {
    const txt = btnElement.previousElementSibling;
    const respuesta = txt ? txt.value.trim() : '';
    
    if(!respuesta) {
        alert("Escriu una resposta.");
        if(txt) txt.focus();
        return;
    }
    
    const token = localStorage.getItem('jwt');
    btnElement.innerText = "Enviant..."; 
    btnElement.disabled = true;

    try {
        // PARCHE: Enviamos de nuevo el studentId para que Strapi v5 no rompa la relación (link persistence)
        const payload = { 
            data: { 
                resposta_professor: respuesta, 
                estat: 'respost',
                users_permissions_user: studentId // Re-vinculamos al alumno
            } 
        };

        const respuestaPut = await fetch(`${API_ROUTES.messages}/${msgId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        if (!respuestaPut.ok) throw new Error("Error en el servidor al actualizar mensaje");
        
        const card = document.getElementById(`msg-card-${msgId}`);
        if(card) card.remove();

        // Notificar al alumno
        if(studentId && studentId !== 'undefined' && studentId !== 'null') {
            const tema = decodeURIComponent(encodedTema);
            await fetch(API_ROUTES.notifications, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    data: {
                        titol: "Dubte Respost",
                        missatge: `El professor ha respost al teu dubte sobre: "${tema}".`,
                        llegida: false,
                        users_permissions_user: studentId
                    }
                })
            });
        }
        
        // Actualizamos las bolitas rojas de notificaciones
        if (window.checkRealNotifications) checkRealNotifications();
        
    } catch(e) {
        console.error(e);
        alert("Error al enviar la resposta.");
        btnElement.innerText = "Enviar Resposta"; 
        btnElement.disabled = false;
    }
};

// --- CARGA DE CURSOS ---
window.loadUserCourses = async function() { await renderCoursesLogic('dashboard'); };
window.loadCatalog = async function() { await renderCoursesLogic('home'); };

async function renderCoursesLogic(viewMode) {
    const listId = viewMode === 'dashboard' ? 'courses-list' : 'catalog-list';
    const list = document.getElementById(listId);
    if(!list) return;
    
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));
    list.innerHTML = '<div class="loader"></div>';
    
    // 1. Funció per netejar el text de Strapi v5
    const extractPlainText = (blocks) => {
        if (!blocks) return "";
        
        // Si és un text simple, agafem fins al primer salt de línia
        if (typeof blocks === 'string') return blocks.split('\n')[0];
        
        // Si és l'array de blocs de Strapi v5
        if (Array.isArray(blocks) && blocks.length > 0) {
            // Agafem només el primer bloc (la primera línia/paràgraf)
            const firstBlock = blocks[0];
            if (firstBlock.children) {
                const text = firstBlock.children.map(child => child.text || "").join("");
                // Per si dins del mateix paràgraf han fet un salt de línia manual
                return text.split('\n')[0];
            }
        }
        return "";
    };


    try {
        const ts = new Date().getTime();
        const resMat = await fetch(`${STRAPI_URL}/api/matriculas?filters[users_permissions_user][id][$eq]=${user.id}&populate[curs][populate]=imatge&_t=${ts}`, { headers: { 'Authorization': `Bearer ${token}` } });
        
        if (resMat.status === 401 || resMat.status === 403) {
            localStorage.clear();
            window.location.reload();
            return;
        }

        const jsonMat = await resMat.json();
        const userMatriculas = jsonMat.data || [];
        
        let cursosAMostrar = [];

        const debeMostrarse = (curs) => {
            if (!curs) return false;
            if (user.es_professor === true) return true;
            return curs.mode_esborrany !== true;
        };

        if (viewMode === 'dashboard') {
            cursosAMostrar = userMatriculas
                .filter(m => m.curs && debeMostrarse(m.curs)) 
                .map(m => ({ ...m.curs, _matricula: m }));
        } else {
            const resCat = await fetch(`${STRAPI_URL}/api/cursos?populate=imatge&_t=${ts}`, { headers: { 'Authorization': `Bearer ${token}` } });
            const jsonCat = await resCat.json();
            
            cursosAMostrar = jsonCat.data
                .filter(c => debeMostrarse(c))
                .map(c => {
                    const existingMat = userMatriculas.find(m => (m.curs.documentId || m.curs.id) === (c.documentId || c.id));
                    return { ...c, _matricula: existingMat };
                });
        }

        cursosAMostrar.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

        list.innerHTML = '';
        if(cursosAMostrar.length === 0) {
            list.innerHTML = '<p style="text-align:center; padding:20px; width:100%;">No hi ha cursos disponibles.</p>';
            return;
        }

        cursosAMostrar.forEach((curs) => {
            const cursId = curs.documentId || curs.id;
            const safeTitle = curs.titol.replace(/'/g, "\\'");
            let imgUrl = 'img/logo-sicap.png';
            if(curs.imatge) {
                const img = Array.isArray(curs.imatge) ? curs.imatge[0] : curs.imatge;
                if(img?.url) imgUrl = img.url.startsWith('/') ? STRAPI_URL + img.url : img.url;
            }

            const hoy = new Date();
            const rawInicio = curs.data_inici || curs.fecha_inicio || curs.publishedAt;
            const fechaInicio = new Date(rawInicio);
            const esFuturo = fechaInicio > hoy;
            const dateStr = fechaInicio.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const esProfe = user.es_professor === true;

            let badge = '';
            if (curs.mode_esborrany) {
                badge = `<span class="course-badge" style="background:#6f42c1;">👁️ OCULT (MODE TEST)</span>`;
            } else if (esFuturo) {
                badge = `<span class="course-badge" style="background:#fff3cd; color:#856404; border:1px solid #ffeeba;">Disponible el ${dateStr}</span>`;
            } else if (curs.etiqueta) {
                badge = `<span class="course-badge">${curs.etiqueta}</span>`;
            }

            let actionHtml = '';
            let progressHtml = '';

            if (curs._matricula) {
                const mat = curs._matricula;
                let pct = mat.progres || 0;
                if(mat.progres_detallat?.examen_final?.aprobado) { pct = 100; }
                
                const color = pct >= 100 ? '#10b981' : 'var(--brand-blue)';
                progressHtml = `
                    <div class="progress-container">
                        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%; background:${color}"></div></div>
                        <span class="progress-text">${pct}% Completat</span>
                    </div>`;
                
                if (esFuturo && !esProfe) {
                    actionHtml = `
                        <button class="btn-primary" style="background-color:#95a5a6; cursor:not-allowed; opacity:0.8;" 
                            onclick="window.mostrarModalError('Aquest curs s’obrirà el dia <strong>${dateStr}</strong>Fins aleshores no pots accedir al contingut.')">
                            Inicia el ${dateStr}
                        </button>`;
                } else {
                    actionHtml = `<a href="index.html?slug=${curs.slug}" class="btn-primary">Accedir</a>`;
                }
            } else {
                actionHtml = `<button class="btn-enroll" onclick="window.solicitarMatricula('${cursId}', '${safeTitle}')">Matricular-me</button>`;
            }

            // 2. APLICAR LA NETEJA DE TEXT AQUÍ
            const descripcionLimpia = extractPlainText(curs.descripcio);

            list.innerHTML += `
                <div class="course-card-item">
                    <div class="card-image-header" style="background-image: url('${imgUrl}');">${badge}</div>
                    <div class="card-body">
                        <h3 class="course-title">${curs.titol}</h3>
                        <div class="course-hours"><i class="fa-regular fa-clock"></i> ${curs.hores ? curs.hores + ' Hores' : 'N/A'}</div>
                        
                        <!-- 3. USAR LA VARIABLE DESCRIPCIONLIMPIA -->
                        <div class="course-desc-container">
                            <p class="course-desc short">${descripcionLimpia}</p>
                        </div>

                        ${progressHtml}
                        ${actionHtml}
                    </div>
                </div>`;
        });
    } catch(e) { console.error(e); }
}

window.solicitarMatricula = function(id, title) {
    window.mostrarModalConfirmacion("Matrícula", `Vols inscriure't a "${title}"?`, async () => {
        const user = JSON.parse(localStorage.getItem('user'));
        const token = localStorage.getItem('jwt');
        try {
            const res = await fetch(`${STRAPI_URL}/api/matriculas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ data: { curs: id, users_permissions_user: user.id, progres: 0, estat: 'actiu', data_inici: new Date().toISOString(), progres_detallat: {} } })
            });
            if (!res.ok) throw new Error("Error API");

            try {
                await fetch(API_ROUTES.notifications, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ data: { titol: "Matrícula Realitzada", missatge: `T'has inscrit al curs: "${title}".`, llegida: false, users_permissions_user: user.id } })
                });
            } catch(e) {}
            window.location.reload();
        } catch(e) { alert("Error al matricular."); }
    });
};

async function loadFullProfile() {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');
    if (!user) return;

    // 1. Recuperar nombre e iniciales del localStorage (guardados en iniciarApp)
    const nombreReal = localStorage.getItem('user_fullname') || user.username;
    let initials = nombreReal.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    // 2. Rellenar la Sidebar de la ficha (Nombre, Iniciales y DNI)
    const safeSet = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
    
    safeSet('profile-name-display', nombreReal);
    safeSet('profile-avatar-big', initials);
    safeSet('profile-dni-display', user.username); // Aquí es donde se quitan los puntos ...

    // 3. Rellenar el input de Email
    const emailInput = document.getElementById('prof-email');
    if (emailInput) emailInput.value = user.email;

    try {
        // 4. Cargar datos detallados desde Afiliados
        const resAfi = await fetch(`${STRAPI_URL}/api/afiliados?filters[dni][$eq]=${user.username}`, { 
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const jsonAfi = await resAfi.json();

        if (jsonAfi.data && jsonAfi.data.length > 0) {
            const afi = jsonAfi.data[0];
            // Mapa de IDs de inputs vs Campos en Strapi
            const map = { 
                'prof-movil': 'TelefonoMobil', 
                'prof-prov': 'Provincia', 
                'prof-pob': 'Poblacion', 
                'prof-centre': 'CentroTrabajo', 
                'prof-cat': 'CategoriaProfesional', 
                'prof-dir': 'Direccion', 
                'prof-iban': 'IBAN' 
            };

            for (const [id, key] of Object.entries(map)) {
                const el = document.getElementById(id);
                if (el && afi[key]) {
                    el.value = afi[key];
                    el.style.cursor = "copy";
                    el.title = "Clic per copiar";
                    el.onclick = () => {
                        navigator.clipboard.writeText(el.value);
                        // Opcional: mini feedback visual al copiar
                        const originalColor = el.style.backgroundColor;
                        el.style.backgroundColor = "#e8f5e9";
                        setTimeout(() => el.style.backgroundColor = originalColor, 500);
                    };
                }
            }
        }

        // 5. Cargar Estadísticas (Cursos y Horas)
        const resMat = await fetch(`${STRAPI_URL}/api/matriculas?filters[users_permissions_user][id][$eq]=${user.id}&populate=curs`, { 
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const jsonMat = await resMat.json();
        
        let started = 0, finished = 0, hours = 0;
        
        if (jsonMat.data) {
            jsonMat.data.forEach(m => {
                started++;
                const isDone = m.estat === 'completat' || m.progres >= 100 || m.progres_detallat?.examen_final?.aprobado;
                if (isDone) {
                    finished++;
                    if (m.curs && m.curs.hores) hours += parseInt(m.curs.hores);
                }
            });
        }

        const statsCont = document.getElementById('profile-stats-container');
        if (statsCont) statsCont.style.display = 'block';
        
        safeSet('stat-started', started);
        safeSet('stat-finished', finished);
        safeSet('stat-hours', hours + 'h');

    } catch (e) { 
        console.error("Error al cargar el perfil completo:", e); 
    }
}

async function loadGrades() {
    const tbody = document.getElementById('grades-table-body');
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('jwt');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4"><div class="loader"></div></td></tr>';

    try {
        const res = await fetch(`${STRAPI_URL}/api/matriculas?filters[users_permissions_user][id][$eq]=${user.id}&populate=curs.moduls`, { headers: { 'Authorization': `Bearer ${token}` }});
        const json = await res.json();
        tbody.innerHTML = '';
        window.gradesCache = [];

        if(!json.data || json.data.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Sense qualificacions.</td></tr>'; 
            return; 
        }

        json.data.forEach((mat, idx) => {
            try {
                const curs = mat.curs;
                if(!curs) return;
                
                window.gradesCache[idx] = { matricula: mat, curso: curs };
                
                const isDone = mat.estat === 'completat' || mat.progres >= 100 || mat.progres_detallat?.examen_final?.aprobado;
                const nota = mat.nota_final || mat.progres_detallat?.examen_final?.nota || '-';
                const color = isDone ? '#10b981' : 'var(--brand-blue)';
                
                let btnCert = '<small>Pendent</small>';
                
                if (isDone) {
                    const hoy = new Date();
                    hoy.setHours(0, 0, 0, 0);
                    // 1. Obtenir dates clau (Matrícula i Inici de curs)
                    const tMatricula = mat.createdAt ? new Date(mat.createdAt).getTime() : hoy.getTime();
                    const rawInicio = curs.data_inici || curs.fecha_inicio || curs.publishedAt;
                    const tInicio = new Date(rawInicio).getTime();

                    // 2. La permanència comença a comptar des de la data més TARDANA (Inici o Matrícula)
                    let dataBasePermanencia = new Date(Math.max(tMatricula, tInicio));

                    // 3. Calculem els 14 dies de rigor
                    let fechaDesbloqueo = new Date(dataBasePermanencia);
                    fechaDesbloqueo.setDate(fechaDesbloqueo.getDate() + 14); 
                    fechaDesbloqueo.setHours(0, 0, 0, 0);
                    
                    // 4. REGLA MESTRA: Si el curs finalitza oficialment, el diploma s'allibera aquell dia
                    // encara que no s'hagin complert els 14 de l'alumne.
                    const rawFin = curs.data_fi || curs.fecha_fin;
                    if (rawFin) {
                        const fechaFinCurso = new Date(rawFin);
                        if (!isNaN(fechaFinCurso.getTime()) && fechaFinCurso < fechaDesbloqueo) {
                            fechaDesbloqueo = fechaFinCurso;
                        }
                    }

                    // 5. Verificació final per mostrar o bloquejar el botó
                    if (hoy < fechaDesbloqueo) {
                        const fechaStr = fechaDesbloqueo.toLocaleDateString('ca-ES');
                        btnCert = `<small style="color:#d97706; font-weight:bold; cursor:help;" title="Disponible el ${fechaStr}">Disponible el ${fechaStr}</small>`;
                    } else {
                        btnCert = `<button class="btn-small" onclick="window.callPrintDiploma(${idx})"><i class="fa-solid fa-file-invoice"></i> Certificat</button>`;
                    }
                }

                tbody.innerHTML += `
                    <tr style="border-bottom:1px solid #eee;">
                        <td data-label="Curs" style="padding:15px;"><strong>${curs.titol}</strong></td>
                        <td data-label="Estat" style="padding:15px; color:${color}; font-weight:bold;">${isDone ? 'Completat' : mat.progres+'%'}</td>
                        <td data-label="Nota" style="padding:15px;">${nota}</td>
                        <td data-label="Diploma" style="padding:15px;">${btnCert}</td>
                    </tr>`;
            } catch (innerE) {
                console.error("Error al renderizar fila de notas:", innerE);
            }
        });
    } catch(e) { 
        console.error(e); 
        tbody.innerHTML = '<tr><td colspan="4">Error al carregar notes.</td></tr>'; 
    }
}

window.callPrintDiploma = function(idx) {
    const data = window.gradesCache[idx];
    if(data) window.imprimirDiplomaCompleto(data.matricula, data.curso);
};

window.imprimirDiplomaCompleto = function(matriculaData, cursoData) {
    const user = JSON.parse(localStorage.getItem('user'));
    const nombreAlumno = (localStorage.getItem('user_fullname') || user.username).toUpperCase();
    const nombreCurso = cursoData.titol;
    const horas = cursoData.hores || 'N/A';
    const matId = matriculaData.documentId || matriculaData.id;
    const nota = matriculaData.nota_final || matriculaData.progres_detallat?.examen_final?.nota || 'APTE';
    
    const rawInicio = cursoData.fecha_inicio || cursoData.data_inici || cursoData.publishedAt;
    const dataInici = rawInicio ? new Date(rawInicio).toLocaleDateString('ca-ES') : 'N/A';
    const rawFin = cursoData.fecha_fin || cursoData.data_fi;
    const dataFi = rawFin ? new Date(rawFin).toLocaleDateString('ca-ES') : 'N/A';
    const fechaHoy = new Date().toLocaleDateString('ca-ES', { year:'numeric', month:'long', day:'numeric' });
    
    const currentDomain = window.location.origin;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentDomain + '/verify.html?ref=' + matId)}`;

    let temarioHtml = '<p>Temari complet segons pla formatiu.</p>';
    if(cursoData.moduls && cursoData.moduls.length > 0) {
        temarioHtml = '<ul style="margin:0; padding-left:20px;">' + cursoData.moduls.map((m,i) => `<li style="margin-bottom:5px;"><strong>Mòdul ${i+1}:</strong> ${m.titol}</li>`).join('') + '</ul>';
    }

    let printDiv = document.getElementById('diploma-print-container');
    if(!printDiv) {
        printDiv = document.createElement('div');
        printDiv.id = 'diploma-print-container';
        document.body.appendChild(printDiv);
    }

    // Firma levantada (margin-bottom: 5px)
    printDiv.innerHTML = `
        <div class="diploma-page">
            <div class="diploma-border-outer">
                <div class="diploma-border-inner">
                    <img src="img/logo-sicap.png" class="diploma-watermark">
                    <img src="img/logo-sicap.png" class="diploma-logo-top">
                    <h1 class="diploma-title">CERTIFICAT D'APROFITAMENT</h1>
                    <p class="diploma-text">El Sindicat Català de Presons (SICAP) certifica que</p>
                    <div class="diploma-student">${nombreAlumno}</div>
                    <p class="diploma-text">Amb DNI <strong>${user.username}</strong>, ha superat satisfactòriament el curs:</p>
                    <h2 class="diploma-course">${nombreCurso}</h2>
                    <div class="diploma-details">
                        <p class="diploma-text">Amb una durada de <strong>${horas} hores</strong> lectives.</p>
                        <p class="diploma-text">Qualificació: <strong>${nota}</strong></p>
                        <p class="diploma-text" style="margin-top:20px; font-size:0.95rem;">Barcelona, ${fechaHoy}</p>
                    </div>
                    <div class="diploma-footer">
                        <div class="footer-qr-area"><img src="${qrSrc}" class="qr-image"><div class="qr-ref">Ref: ${matId}</div></div>
                        <div class="footer-signature-area">
                            <img src="img/firma-miguel.png" style="height: 70px; display: block; margin: 0 auto 5px auto; position: relative; z-index: 10;">
                            <div class="signature-line"></div>
                            <span class="signature-name">Miguel Pueyo Pérez</span>
                            <span class="signature-role">Secretari General</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="diploma-page">
            <div class="diploma-border-outer">
                <div class="diploma-border-inner" style="align-items:flex-start; text-align:left; padding:40px;">
                    <img src="img/logo-sicap.png" class="diploma-watermark">
                    <div style="width:100%; position:relative; z-index:2;">
                        <div style="display:flex; justify-content:space-between; width:100%; border-bottom:2px solid var(--brand-blue); margin-bottom:20px; padding-bottom:10px;">
                            <h3 style="margin:0; color:var(--brand-blue); text-transform:uppercase;">Expedient Formatiu</h3>
                            <img src="img/logo-sicap.png" style="height:30px; opacity:0.6;">
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:30px; padding:15px; border:1px solid #eee; border-radius:8px;">
                            <div><span style="display:block; font-size:0.75rem; color:#666; text-transform:uppercase;">Alumne</span><strong style="font-size:1rem;">${nombreAlumno}</strong></div>
                            <div><span style="display:block; font-size:0.75rem; color:#666; text-transform:uppercase;">Document Identitat</span><strong style="font-size:1rem;">${user.username}</strong></div>
                            <div style="grid-column:span 2;"><span style="display:block; font-size:0.75rem; color:#666; text-transform:uppercase;">Activitat Formativa</span><strong style="font-size:1rem;">${nombreCurso}</strong></div>
                            <div><span style="display:block; font-size:0.75rem; color:#666; text-transform:uppercase;">Data Inici</span><strong style="font-size:1rem;">${dataInici}</strong></div>
                            <div><span style="display:block; font-size:0.75rem; color:#666; text-transform:uppercase;">Data Finalització</span><strong style="font-size:1rem;">${dataFi}</strong></div>
                            <div><span style="display:block; font-size:0.75rem; color:#666; text-transform:uppercase;">Durada</span><strong style="font-size:1rem;">${horas} Hores</strong></div>
                            <div><span style="display:block; font-size:0.75rem; color:#666; text-transform:uppercase;">Data Expedició</span><strong style="font-size:1rem;">${fechaHoy}</strong></div>
                        </div>
                        <h4 style="color:var(--brand-blue); border-bottom:1px solid #ccc; padding-bottom:5px; margin-bottom:15px; text-transform:uppercase;">Continguts (Temari)</h4>
                        <div style="font-size:0.9rem; line-height:1.6;">${temarioHtml}</div>
                    </div>
                    <div style="position:absolute; bottom:20px; left:0; width:100%; text-align:center; font-size:0.8rem; color:#666; border-top:1px solid #eee; padding-top:10px;">
                        SICAP - Sindicat Català de Presons - Unitat de Formació
                    </div>
                </div>
            </div>
        </div>`;
    
    // Configurar nombre del archivo: SICAP-NombreCurso-Año
    const anyo = new Date().getFullYear();
    const nombreLimpio = cursoData.titol.replace(/[^a-z0-9]/gi, '-');
    document.title = `SICAP-${nombreLimpio}-${anyo}`;

    setTimeout(() => {
        window.print();
        setTimeout(() => document.title = "SICAP Campus Virtual", 2000);
    }, 1500);
};

window.mostrarModalError = function(msg) {
    const m = document.getElementById('custom-modal');
    document.getElementById('modal-title').innerText = "Informació";
    document.getElementById('modal-title').style.color = "var(--brand-blue)";
    document.getElementById('modal-msg').innerHTML = msg;
    document.getElementById('modal-btn-cancel').style.display = 'none';
    const btn = document.getElementById('modal-btn-confirm');
    btn.innerText = "D'acord";
    btn.disabled = false;
    btn.onclick = () => m.style.display = 'none';
    m.style.display = 'flex';
};

window.mostrarModalConfirmacion = function(titulo, msg, callback) {
    const m = document.getElementById('custom-modal');
    document.getElementById('modal-title').innerText = titulo;
    document.getElementById('modal-msg').innerHTML = msg;
    document.getElementById('modal-btn-cancel').style.display = 'block';
    const btn = document.getElementById('modal-btn-confirm');
    btn.innerText = "Confirmar";
    btn.disabled = false;
    btn.onclick = () => { m.style.display = 'none'; callback(); };
    const btnC = document.getElementById('modal-btn-cancel');
    btnC.onclick = () => m.style.display = 'none';
    m.style.display = 'flex';
};