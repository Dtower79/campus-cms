/* ==========================================================================
   RENDERITZADORCURS.JS (v57.15 - EXTRA CONTENT & SYNTAX PATCH)
   ========================================================================== */
if (new URLSearchParams(window.location.search).has('code')) {
    console.log("🛑 Bloqueo preventivo activado en Renderitzador.");
    throw new Error("Reset en curso"); 
}

console.log("🚀 Carregant Renderitzador v57.15...");

// 1. Definimos el estado global FUERA para que la consola lo vea
window.state = {
    matriculaId: null,
    matriculaCreatedAt: null,
    curso: null,
    progreso: {},
    currentModuleIndex: -1,
    currentView: 'intro',   
    respuestasTemp: {},
    testStartTime: 0,
    testEnCurso: false,
    godMode: false,
    preguntasExamenFinal: [],
    preguntasSesionActual: [],
    timerInterval: null
};

document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(window.location.search).has('code')) return; 
    // Alias local para no romper el código existente que usa la palabra 'state'
    let state = window.state;

    function parseStrapiRichText(content) {
        if (!content) return '';
        if (typeof content === 'string') return content;
        const extractText = (children) => {
            if (!children) return "";
            return children.map(node => {
                if (node.type === "text") {
                    let text = node.text || "";
                    if (node.bold) text = `<strong>${text}</strong>`;
                    if (node.italic) text = `<em>${text}</em>`;
                    if (node.underline) text = `<u>${text}</u>`;
                    if (node.strikethrough) text = `<strike>${text}</strike>`;
                    if (node.code) text = `<code>${text}</code>`;
                    return text;
                }
                if (node.type === "link") return `<a href="${node.url}" target="_blank">${extractText(node.children)}</a>`;
                return "";
            }).join("");
        };
        if (Array.isArray(content)) {
            return content.map(block => {
                switch (block.type) {
                    case 'heading': return `<h${block.level || 3}>${extractText(block.children)}</h${block.level || 3}>`;
                    case 'paragraph': return `<p>${extractText(block.children)}</p>`;
                    case 'list': return `<${block.format === 'ordered' ? 'ol' : 'ul'}>${block.children.map(i => `<li>${extractText(i.children)}</li>`).join('')}</${block.format === 'ordered' ? 'ol' : 'ul'}>`;
                    default: return extractText(block.children);
                }
            }).join('');
        }
        return JSON.stringify(content);
    }

    const PARAMS = new URLSearchParams(window.location.search);
    const SLUG = PARAMS.get('slug');
    if (!SLUG) return;
    const USER = JSON.parse(localStorage.getItem('user'));
    const TOKEN = localStorage.getItem('jwt');
    if (!USER || !TOKEN) { window.location.href = 'index.html'; return; }

    const elems = {
        loginOverlay: document.getElementById('login-overlay'),
        appContainer: document.getElementById('app-container'),
        dashboardView: document.getElementById('dashboard-view'),
        examView: document.getElementById('exam-view'),
        appFooter: document.getElementById('app-footer')
    };
    if(elems.loginOverlay) elems.loginOverlay.style.display = 'none';
    if(elems.appContainer) elems.appContainer.style.display = 'block';
    if(elems.dashboardView) elems.dashboardView.style.display = 'none';
    if(elems.examView) elems.examView.style.display = 'flex';
    if(elems.appFooter) elems.appFooter.style.display = 'block';

    function shuffleArray(array) {
        if (!array) return [];
        return array.map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(({ value }) => value);
    }

    function prepararExamen(mod) {
        const pool = mod.banc_preguntes || [];
        const limite = pool.length; 
        let seleccionadas = shuffleArray(pool).slice(0, limite);
        return seleccionadas.map(p => {
            const pClon = JSON.parse(JSON.stringify(p));
            pClon.opcions = shuffleArray(pClon.opcions);
            return pClon;
        });
    }

    init();

    setTimeout(() => {
        const left = document.querySelector('.sidebar-left');
        const right = document.querySelector('.sidebar-right');
        const toggleSidebar = (el) => { if(window.innerWidth <= 1000) el.classList.toggle('sidebar-mobile-open'); };
        if(left) left.onclick = (e) => { if(!e.target.closest('a') && !e.target.closest('.sidebar-subitem')) toggleSidebar(left); };
        if(right) right.onclick = (e) => { if(e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') toggleSidebar(right); };
    }, 500);

    async function init() {
        const container = document.getElementById('moduls-container');
        if(container) container.innerHTML = '<div class="loader"></div>';
        try {
            await cargarDatos();

            // SEGURIDAD: Reset de horas para evitar retrasos UTC de 1h
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0); 
            const rawInicio = state.curso.data_inici || state.curso.fecha_inicio || state.curso.publishedAt;
            const fechaInicio = new Date(rawInicio);
            fechaInicio.setHours(0, 0, 0, 0); 

            if (fechaInicio > hoy && USER.es_professor !== true) {
                alert(`Aquest curs encara no ha començat. Data d'inici: ${fechaInicio.toLocaleDateString('ca-ES')}`);
                window.location.href = 'index.html';
                return;
            }

            if (!state.progreso || Object.keys(state.progreso).length === 0) await inicializarProgresoEnStrapi();
            if (!(state.progreso.examen_final && state.progreso.examen_final.aprobado)) await sincronizarAvanceLocal();
            
            renderSidebar();
            renderMainContent();
        } catch (e) {
            console.error(e);
            if(container) container.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
        }
    }

    async function sincronizarAvanceLocal() {
        let huboCambios = false;
        const modulos = state.curso.moduls || [];
        modulos.forEach((mod, idx) => {
            if (mod.targetes_memoria && mod.targetes_memoria.length > 0) {
                const flippedIndices = getFlippedCards(idx);
                const localmenteCompletado = flippedIndices.length >= mod.targetes_memoria.length;
                if (!state.progreso.modulos[idx]) state.progreso.modulos[idx] = { aprobado:false, nota:0, intentos:0, flashcards_done: false };
                const estadoRemoto = state.progreso.modulos[idx].flashcards_done;
                if (localmenteCompletado && !estadoRemoto) {
                    state.progreso.modulos[idx].flashcards_done = true;
                    huboCambios = true;
                }
            }
        });
        if (huboCambios) try { await guardarProgreso(state.progreso); } catch(e) {}
    }

    async function cargarDatos() {
        // QUERY PATCH PARA STRAPI V5 (Trae es_extra de los módulos)
        const query = `filters[users_permissions_user][id][$eq]=${USER.id}&filters[curs][slug][$eq]=${SLUG}&populate[curs][populate][moduls][populate][banc_preguntes][populate][opcions]=true&populate[curs][populate][moduls][populate][material_pdf]=true&populate[curs][populate][moduls][populate][targetes_memoria]=true&populate[curs][populate][moduls][populate][videos][populate]=true&populate[curs][populate][examen_final][populate][opcions]=true&populate[curs][populate][imatge]=true&populate[curs][populate][videos][populate]=true&populate[curs][populate][moduls][fields][0]=es_extra&populate[curs][populate][moduls][fields][1]=titol&populate[curs][populate][moduls][fields][2]=resum&populate[curs][populate][moduls][fields][3]=ordre`;
        
        const respuestaMat = await fetch(`${STRAPI_URL}/api/matriculas?${query}`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        const jsonMat = await respuestaMat.json();

        if (!jsonMat.data || jsonMat.data.length === 0) {
            window.location.href = 'index.html'; 
            return;
        }
        
        const mat = jsonMat.data[0];
        const dataM = mat.attributes ? mat.attributes : mat; // Soporte Strapi v4/v5

        state.matriculaId = mat.documentId || mat.id;
        state.matriculaCreatedAt = dataM.createdAt;
        state.curso = dataM.curs;
        if (!state.curso.moduls) state.curso.moduls = [];
        state.progreso = dataM.progres_detallat || {};
        localStorage.setItem(`sicap_last_matricula_${SLUG}`, String(state.matriculaId));
    }

    async function inicializarProgresoEnStrapi() {
        const modulos = state.curso.moduls || [];
        state.progreso = {
            modulos: modulos.map(() => ({ aprobado: false, nota: 0, intentos: 0, flashcards_done: false })),
            examen_final: { aprobado: false, nota: 0, intentos: 0 }
        };
        await guardarProgreso(state.progreso);
    }

    async function guardarProgreso(progresoObj) {
        state.progreso = progresoObj;
        let total = 0, done = 0;
        state.curso.moduls.forEach((mod, i) => {
             total++; if(progresoObj.modulos[i]?.aprobado) done++;
             if(mod.targetes_memoria?.length > 0) { total++; if(progresoObj.modulos[i]?.flashcards_done) done++; }
        });
        if(state.curso.examen_final?.length > 0) { total++; if(progresoObj.examen_final?.aprobado) done++; }
        let pct = total > 0 ? Math.round((done/total)*100) : 0;
        if(progresoObj.examen_final?.aprobado) pct = 100;

        const payload = { data: { progres_detallat: progresoObj, progres: pct, estat: pct >= 100 ? 'completat' : 'actiu' } };
        if(progresoObj.examen_final?.aprobado) payload.data.nota_final = progresoObj.examen_final.nota;

        try {
            await fetch(`${STRAPI_URL}/api/matriculas/${state.matriculaId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }, body: JSON.stringify(payload)
            });
            renderSidebar();
        } catch(e) {}
    }

    // 4. NOTIFICACIONES
    async function crearNotificacion(titulo, mensaje) {
        try {
            await fetch(API_ROUTES.notifications, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
                body: JSON.stringify({ data: { titol: titulo, missatge: mensaje, llegida: false, users_permissions_user: USER.id } })
            });
            if(window.checkRealNotifications) window.checkRealNotifications();
        } catch(e) {}
    }

    function verificarFinModulo(modIdx) {
        const mod = state.curso.moduls[modIdx];
        const modProg = state.progreso.modulos[modIdx];
        if (!mod || !modProg) return;
        const testOk = modProg.aprobado;
        const flashOk = (mod.targetes_memoria && mod.targetes_memoria.length > 0) ? modProg.flashcards_done : true;
        if (testOk && flashOk) crearNotificacion(`Mòdul ${modIdx + 1} Completat`, `Enhorabona! Has completat totes les activitats del mòdul: "${mod.titol}".`);
    }

    async function notificarAprobado(cursoTitulo) {
        const hoy = new Date();
        let fechaInscripcion = state.matriculaCreatedAt ? new Date(state.matriculaCreatedAt) : new Date();
        const fechaDesbloqueo = new Date(fechaInscripcion);
        fechaDesbloqueo.setDate(fechaDesbloqueo.getDate() + 14);

        const rawFin = state.curso.fecha_fin || state.curso.data_fi;
        if (rawFin) {
            const fechaFinCurso = new Date(rawFin);
            if (fechaFinCurso < fechaDesbloqueo) fechaDesbloqueo = fechaFinCurso;
        }

        const estaBloqueado = hoy < fechaDesbloqueo;
        let mensaje = "";
        
        if (estaBloqueado) {
            const fechaStr = fechaDesbloqueo.toLocaleDateString('ca-ES');
            mensaje = `Enhorabona! Has aprovat "${cursoTitulo}". El diploma estarà disponible automàticament el dia ${fechaStr}.`;
        } else {
            mensaje = `Enhorabona! Has aprovat "${cursoTitulo}". El teu diploma ja està disponible per descarregar.`;
        }

        crearNotificacion("Curs Completat! 🎓", mensaje);
    }

    // 5. STORAGE & HELPERS
    function getStorageKey(tipo) { return `sicap_progress_${USER.id}_${state.curso.slug}_${tipo}`; }
    function guardarRespuestaLocal(tipo, preguntaId, opcionIdx) {
        const key = getStorageKey(tipo);
        let data = JSON.parse(localStorage.getItem(key)) || {};
        data[preguntaId] = opcionIdx; data.timestamp = Date.now();
        localStorage.setItem(key, JSON.stringify(data));
    }
    function cargarRespuestasLocales(tipo) {
        const key = getStorageKey(tipo);
        const data = JSON.parse(localStorage.getItem(key));
        if (data) { delete data.timestamp; return data; }
        return {};
    }
    function limpiarRespuestasLocales(tipo) {
        localStorage.removeItem(getStorageKey(tipo));
        if(tipo === 'examen_final') {
            localStorage.removeItem(`sicap_timer_start_${USER.id}_${SLUG}`);
            localStorage.removeItem(`sicap_exam_order_${USER.id}_${SLUG}`); 
        }
    }
    function getFlippedCards(modIdx) { return JSON.parse(localStorage.getItem(`sicap_flipped_${USER.id}_${state.curso.slug}_mod_${modIdx}`)) || []; }
    function addFlippedCard(modIdx, cardIdx) {
        const key = `sicap_flipped_${USER.id}_${state.curso.slug}_mod_${modIdx}`;
        let current = getFlippedCards(modIdx);
        if (!current.includes(cardIdx)) { current.push(cardIdx); localStorage.setItem(key, JSON.stringify(current)); }
        return current.length;
    }

    function estaBloqueado(indexModulo) {
        if (state.godMode) return false;
        const mod = state.curso.moduls[indexModulo];
        
        // --- NOVA LÒGICA PER A CONTINGUT EXTRA ---
        if (mod && mod.es_extra === true) return false;
        
        if (indexModulo === 0) return false;
        const prevIdx = indexModulo - 1;
        const prevProg = state.progreso.modulos[prevIdx];
        if (!prevProg) return true;
        
        return !(prevProg.aprobado === true && (state.curso.moduls[prevIdx].targetes_memoria?.length > 0 ? prevProg.flashcards_done : true));
    }

    function puedeHacerExamenFinal() {
        if (state.godMode) return true;
        if (state.progreso && state.progreso.examen_final && state.progreso.examen_final.aprobado) return true;
        if (!state.progreso || !state.progreso.modulos) return false;
        
        const modulosCurso = state.curso.moduls || [];

        return modulosCurso.every((modObj, idx) => {
            // Ignoramos los módulos extra para el bloqueo del examen final
            if (modObj.es_extra === true) return true; 

            const m = state.progreso.modulos[idx];
            if (!m) return false;

            const tieneFlash = modObj && modObj.targetes_memoria && modObj.targetes_memoria.length > 0;
            const flashOk = tieneFlash ? (m.flashcards_done === true) : true;
            const testOk = (m.aprobado === true);

            return testOk && flashOk;
        });
    }

    window.toggleAccordion = function(headerElement) {
        const group = headerElement.parentElement;
        if (group.classList.contains('locked-module') && !state.godMode) return;
        group.classList.toggle('open');
    };

    window.toggleGodMode = function(checkbox) { 
        state.godMode = checkbox.checked; 
        renderSidebar(); 
        renderMainContent();
    }

    window.cambiarVista = function(idx, view) {
        state.currentModuleIndex = parseInt(idx);
        state.currentView = view;
        state.respuestasTemp = {}; 
        state.testEnCurso = false;
        if(view === 'test') state.preguntasSesionActual = [];
        
        const container = document.getElementById('moduls-container');
        if(container) { container.innerHTML = ''; container.style.opacity = '0'; }

        renderSidebar(); 
        renderMainContent(); 
        window.scrollTo(0,0);
        
        if(window.innerWidth <= 1000) document.querySelector('.sidebar-left').classList.remove('sidebar-mobile-open');
        setTimeout(() => { const activeItem = document.querySelector('.sidebar-subitem.active'); if(activeItem) activeItem.closest('.sidebar-module-group')?.classList.add('open'); }, 100);
    }

    window.downloadNotes = function() {
        const noteKey = `sicap_notes_${USER.id}_${state.curso.slug}`;
        const content = localStorage.getItem(noteKey) || '';
        if(!content) return alert("No tens apunts guardats per descarregar.");
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `Notes_${state.curso.slug}.txt`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    };

    // 7. RENDERIZADORES
    function renderSidebar() {
        const indexContainer = document.getElementById('course-index');
        document.getElementById('curs-titol').innerText = state.curso.titol;

        let html = '';
        if (USER.es_professor === true) {
            html += `<div style="margin-bottom:15px; padding:10px; border-bottom:1px solid #eee; text-align:center; background:#fff3cd; border-radius:6px;"><label style="font-size:0.85rem; cursor:pointer; font-weight:bold; color:#856404;"><input type="checkbox" ${state.godMode ? 'checked' : ''} onchange="toggleGodMode(this)"> 🕵️ Mode Professor</label></div>`;
        }
        
        const isIntroActive = state.currentModuleIndex === -1;
        html += `<div class="sidebar-module-group ${isIntroActive ? 'open' : ''}"><div class="sidebar-module-title" onclick="toggleAccordion(this)"><span><i class="fa-solid fa-circle-info"></i> Informació General</span></div><div class="sidebar-sub-menu">${renderSubLink(-1, 'intro', '📄 Programa del curs', false, true)}</div></div>`;

        (state.curso.moduls || []).forEach((mod, idx) => {
            const isLocked = estaBloqueado(idx);
            const modProgreso = (state.progreso.modulos && state.progreso.modulos[idx]) ? state.progreso.modulos[idx] : null;
            const tieneFlash = mod.targetes_memoria && mod.targetes_memoria.length > 0;
            const flashDone = modProgreso ? modProgreso.flashcards_done : false;
            const testDone = modProgreso ? modProgreso.aprobado : false;
            const check = (testDone && (tieneFlash ? flashDone : true)) ? '<i class="fa-solid fa-check" style="color:green"></i>' : '';
            const isOpen = (state.currentModuleIndex === idx);
            const lockedClass = (isLocked && !state.godMode) ? 'locked-module' : '';
            const openClass = isOpen ? 'open' : '';

            html += `<div class="sidebar-module-group ${lockedClass} ${openClass}"><div class="sidebar-module-title" onclick="toggleAccordion(this)"><span><i class="fa-regular fa-folder-open"></i> ${mod.titol} ${check}</span></div><div class="sidebar-sub-menu">`;
            html += renderSubLink(idx, 'teoria', '📖 Temari i PDF', isLocked);
            
            if ((!isLocked || state.godMode) && mod.material_pdf) {
                let archivos = Array.isArray(mod.material_pdf) ? mod.material_pdf : [mod.material_pdf];
                archivos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

                if (archivos.length > 0) {
                    archivos.forEach(pdf => {
                        const pdfUrl = pdf.url.startsWith('/') ? STRAPI_URL + pdf.url : pdf.url;
                        html += `<a href="${pdfUrl}" target="_blank" class="sidebar-file-item"><i class="fa-solid fa-file-pdf"></i> ${pdf.name}</a>`;
                    });
                }
            }
            if (tieneFlash) {
                const fCheck = flashDone ? '✓' : '';
                html += renderSubLink(idx, 'flashcards', `🔄 Targetes de Repàs ${fCheck}`, isLocked);
            }
            const tCheck = testDone ? '✓' : '';
            html += renderSubLink(idx, 'test', `📝 Test Avaluació ${tCheck}`, isLocked);
            html += `</div></div>`;
        });

        const isGlossaryActive = state.currentModuleIndex === 1000;
        html += `<div class="sidebar-module-group ${isGlossaryActive ? 'open' : ''}" style="border-top:1px solid #eee; margin-top:10px;"><div class="sidebar-module-title" onclick="toggleAccordion(this)"><span><i class="fa-solid fa-book-bookmark"></i> Recursos</span></div><div class="sidebar-sub-menu">${renderSubLink(1000, 'glossary', '📚 Glossari de Termes', false, true)}</div></div>`;

        const finalIsLocked = !puedeHacerExamenFinal();
        const isFinalActive = state.currentModuleIndex === 999;
        const lockedFinalClass = (finalIsLocked && !state.godMode) ? 'locked-module' : '';
        const openFinalClass = isFinalActive ? 'open' : '';

        html += `<div class="sidebar-module-group ${lockedFinalClass} ${openFinalClass}" style="margin-top:20px; border-top:2px solid var(--brand-blue);"><div class="sidebar-module-title" onclick="toggleAccordion(this)"><span style="color:var(--brand-blue); font-weight:bold;">🎓 Avaluació Final</span></div><div class="sidebar-sub-menu">${renderSubLink(999, 'examen_final', '🏆 Examen Final', finalIsLocked)}</div></div>`;
        indexContainer.innerHTML = html;
    }

    function renderSubLink(modIdx, viewName, label, locked, isSpecial = false) {
        const reallyLocked = locked && !state.godMode;
        let isActive = (String(state.currentModuleIndex) === String(modIdx) && state.currentView === viewName);
        const activeClass = isActive ? 'active' : '';
        const specialClass = isSpecial ? 'special-item' : '';
        const clickFn = reallyLocked ? '' : `window.cambiarVista(${modIdx}, '${viewName}')`;
        const lockIcon = reallyLocked ? '<i class="fa-solid fa-lock"></i> ' : '';
        return `<div class="sidebar-subitem ${activeClass} ${specialClass} ${reallyLocked ? 'locked' : ''}" onclick="${clickFn}">${lockIcon}${label}</div>`;
    }

    function renderMainContent() {
        const container = document.getElementById('moduls-container');
        const gridRight = document.getElementById('quiz-grid');
        
        container.innerHTML = ''; 
        if (gridRight) { gridRight.innerHTML = ''; gridRight.className = ''; }

        detenerCronometro(); 
        document.body.classList.remove('exam-active');
        setTimeout(() => { container.style.opacity = '1'; }, 50);

        if (state.currentView === 'intro') { 
            // 1. Cridem a la funció que ja sap pintar vídeos, però li passem l'objecte "curso" sencer
            const videoIntroHtml = renderVideoPlayer(state.curso); 

            container.innerHTML = `
                <h2><i class="fa-solid fa-book-open"></i> Programa del Curs</h2>
                
                <!-- 2. Pintem els vídeos abans o després de la descripció segons prefereixis -->
                ${videoIntroHtml} 

                <div class="module-content-text" style="margin-top:20px;">
                    ${parseStrapiRichText(state.curso.descripcio || "Descripció no disponible.")}
                </div>
            `; 
            
            renderSidebarTools(gridRight, { titol: 'Programa' }); 
            return; 
        }
        if (state.currentView === 'glossary') { 
            const contenidoGlossari = state.curso.glossari ? parseStrapiRichText(state.curso.glossari) : "<p>No hi ha entrades al glossari.</p>"; 
            container.innerHTML = `<h2><i class="fa-solid fa-spell-check"></i> Glossari de Termes</h2><div class="dashboard-card" style="margin-top:20px;"><div class="module-content-text">${contenidoGlossari}</div></div>`; 
            renderSidebarTools(gridRight, { titol: 'Glossari' }); 
            return; 
        }
        if (state.currentView === 'examen_final') { 
            // FIX CRASH: PROTECCIÓN DE RENDERIZADO
            try { renderExamenFinal(container); } 
            catch (e) { console.error(e); container.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`; }
            return; 
        }

        const mod = state.curso.moduls[state.currentModuleIndex];
        if (!mod) { container.innerHTML = `<div class="alert alert-warning">Mòdul no trobat.</div>`; return; }
        
        if (state.currentView === 'teoria') { renderTeoria(container, mod); renderSidebarTools(gridRight, mod); }
        else if (state.currentView === 'flashcards') { renderFlashcards(container, mod.targetes_memoria, state.currentModuleIndex); renderSidebarTools(gridRight, mod); }
        else if (state.currentView === 'test') {
            const savedData = cargarRespuestasLocales(`test_mod_${state.currentModuleIndex}`);
            const hayDatosGuardados = Object.keys(savedData).length > 0;
            const moduloAprobado = (state.progreso.modulos && state.progreso.modulos[state.currentModuleIndex]) ? state.progreso.modulos[state.currentModuleIndex].aprobado : false;
            
            if ((state.testEnCurso || hayDatosGuardados) && !moduloAprobado) {
                if (gridRight) gridRight.className = 'grid-container';
                state.respuestasTemp = savedData;
                state.testEnCurso = true;
                renderTestQuestions(container, mod, state.currentModuleIndex);
            } else {
                renderTestIntro(container, mod, state.currentModuleIndex);
                renderSidebarTools(gridRight, mod);
            }
        }
    }

    function renderVideoPlayer(mod) {
        if (!mod.videos || mod.videos.length === 0) return '';

        return mod.videos.map(vid => {
            let htmlVideo = '';
            const titolVideo = vid.titol || 'Vídeo del mòdul';

            // CASO 1: Es un archivo subido a Strapi
            if (vid.fitxer && vid.fitxer.url) {
                const videoUrl = vid.fitxer.url.startsWith('/') ? STRAPI_URL + vid.fitxer.url : vid.fitxer.url;
                htmlVideo = `
                    <div class="video-badge"><i class="fa-solid fa-file-video"></i> ${titolVideo}</div>
                    <div class="video-responsive-container">
                        <video controls controlsList="nodownload">
                            <source src="${videoUrl}" type="${vid.fitxer.mime}">
                            El teu navegador no suporta video HTML5.
                        </video>
                    </div>`;
            } 
            // CASO 2: Es una URL externa (YouTube/Vimeo)
            else if (vid.url) {
                let embedUrl = '';
                if (vid.url.includes('youtube.com') || vid.url.includes('youtu.be')) {
                    const videoId = vid.url.split('v=')[1] || vid.url.split('/').pop();
                    const cleanId = videoId.split('&')[0];
                    embedUrl = `https://www.youtube.com/embed/${cleanId}`;
                } else if (vid.url.includes('vimeo.com')) {
                    const videoId = vid.url.split('/').pop();
                    embedUrl = `https://player.vimeo.com/video/${videoId}`;
                }

                if (embedUrl) {
                    htmlVideo = `
                        <div class="video-badge" style="background:#cc181e;">
                            <i class="fa-brands fa-youtube"></i> ${titolVideo}
                        </div>
                        <div class="video-responsive-container">
                            <iframe src="${embedUrl}" title="${titolVideo}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                        </div>`;
                }
            }

            return htmlVideo;
        }).join(''); // Unimos todos los vídeos en un solo string de HTML
    }

    function renderTeoria(container, mod) {
        const videoHtml = renderVideoPlayer(mod);
        let html = `<h2>${mod.titol}</h2>`;
        html += videoHtml;
        if (mod.resum) html += `<div class="module-content-text">${parseStrapiRichText(mod.resum)}</div>`;
        if (mod.material_pdf) {
            let archivos = Array.isArray(mod.material_pdf) ? mod.material_pdf : [mod.material_pdf];
            archivos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            if(archivos.length > 0) {
                html += `<div class="materials-section"><span class="materials-title">Material Descarregable</span>`;
                archivos.forEach(a => {
                    let pdfUrl = a.url.startsWith('/') ? STRAPI_URL + a.url : a.url;
                    html += `<a href="${pdfUrl}" target="_blank" class="btn-pdf"><i class="fa-solid fa-file-pdf"></i> ${a.name}</a>`;
                });
                html += `</div>`;
            }
        }
        const modProg = state.progreso.modulos[state.currentModuleIndex];
        const check = (modProg && modProg.flashcards_done) ? '✓' : '';
        if(mod.targetes_memoria && mod.targetes_memoria.length > 0) {
             html += `<div style="margin-top:30px;"><button class="btn-primary" onclick="window.cambiarVista(${state.currentModuleIndex}, 'flashcards')">Anar a Targetes ${check}</button></div>`;
        } else {
             html += `<div style="margin-top:30px;"><button class="btn-primary" onclick="window.cambiarVista(${state.currentModuleIndex}, 'test')">Anar al Test</button></div>`;
        }
        container.innerHTML = html;
    }

    function renderSidebarTools(container, mod) {
        if (!container) return;
        const savedNote = localStorage.getItem(`sicap_notes_${USER.id}_${state.curso.slug}`) || '';
        const modTitleSafe = mod && mod.titol ? mod.titol.replace(/'/g, "\\'") : 'General';
        let rutaHtml = `<div class="breadcrumbs" style="margin-bottom: 20px;">`;
        const cursoTituloCorto = state.curso.titol.length > 25 ? state.curso.titol.substring(0, 25) + '...' : state.curso.titol;
        rutaHtml += `<span style="color:var(--brand-blue); font-weight:bold;">${cursoTituloCorto}</span>`;
        if (state.currentView === 'intro') rutaHtml += `<span class="breadcrumb-separator">/</span> <span class="breadcrumb-current">Informació</span>`;
        else if (state.currentView === 'glossary') rutaHtml += `<span class="breadcrumb-separator">/</span> <span class="breadcrumb-current">Glossari</span>`;
        else if (mod) {
            const modName = mod.titol.length > 20 ? mod.titol.substring(0, 20) + '...' : mod.titol;
            rutaHtml += `<span class="breadcrumb-separator">/</span> <span>${modName}</span>`;
            let tipoVista = '';
            if (state.currentView === 'teoria') tipoVista = 'Teoria';
            else if (state.currentView === 'flashcards') tipoVista = 'Repàs';
            else if (state.currentView === 'test') tipoVista = 'Test';
            if (tipoVista) rutaHtml += `<span class="breadcrumb-separator">/</span> <span class="breadcrumb-current" style="color:var(--brand-red);">${tipoVista}</span>`;
        }
        rutaHtml += `</div>`;
        container.innerHTML = `${rutaHtml}<div class="sidebar-header"><h3>Eines d'Estudi</h3></div><div class="tools-box"><div class="tools-title" style="display:flex; justify-content:space-between; align-items:center;"><span><i class="fa-regular fa-note-sticky"></i> Les meves notes</span><button class="btn-small" onclick="window.downloadNotes()" title="Descarregar .txt" style="padding:2px 8px; font-size:0.7rem;"><i class="fa-solid fa-download"></i></button></div><textarea id="quick-notes" class="notepad-area" placeholder="Escriu apunts aquí...">${savedNote}</textarea><small style="color:var(--text-secondary); font-size:0.75rem;">Es guarda automàticament.</small></div><div class="tools-box" style="border-color: var(--brand-blue);"><div class="tools-title"><i class="fa-regular fa-life-ring"></i> Dubtes del Temari</div><p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:10px;">Tens alguna pregunta sobre <strong>"${mod ? mod.titol : 'aquí'}"</strong>?</p><button class="btn-doubt" onclick="obrirFormulariDubte('${modTitleSafe}')"><i class="fa-regular fa-paper-plane"></i> Enviar Dubte</button></div>`;
        const noteArea = document.getElementById('quick-notes');
        if(noteArea) noteArea.addEventListener('input', (e) => localStorage.setItem(`sicap_notes_${USER.id}_${state.curso.slug}`, e.target.value));
    }

    // 8. FLASHCARDS
    function renderFlashcards(container, cards, modIdx) {
        if (!cards || cards.length === 0) { container.innerHTML = '<p>No hi ha targetes.</p>'; return; }
        const isCompletedDB = (state.progreso.modulos && state.progreso.modulos[modIdx]) ? state.progreso.modulos[modIdx].flashcards_done === true : false;
        const flippedIndices = getFlippedCards(modIdx);
        const isReallyCompleted = isCompletedDB || (flippedIndices.length >= cards.length);

        let headerHtml = `<div id="fc-header-container">`;
        if(isReallyCompleted) {
            headerHtml += `<div class="alert-info" style="margin-bottom:15px; color:green; background:#d4edda; border:1px solid #c3e6cb; padding:15px; border-radius:4px;"><i class="fa-solid fa-check-circle"></i> <strong>Activitat Completada!</strong><br><small>Ja pots accedir al següent mòdul (si has aprovat el test).</small></div>`;
        } else {
            const count = flippedIndices.length;
            const total = cards.length;
            headerHtml += `<div class="alert-info" style="margin-bottom:15px; color:#856404; background:#fff3cd; border:1px solid #ffeeba; padding:10px; border-radius:4px;"><i class="fa-solid fa-circle-exclamation"></i> Progrés: <strong id="fc-counter-text">${count}/${total}</strong> targetes contestades. Has de fer-les totes per avançar.</div>`;
        }
        headerHtml += `</div>`; 
        let html = `<h3>Targetes de Repàs</h3>${headerHtml}<div class="flashcards-grid-view">`;
        const distractors = ["Règim", "Junta", "DERT", "Aïllament", "Seguretat", "Infermeria", "Ingrés", "Comunicació", "Especialista", "Jurista", "Educador", "Director", "Reglament", "Funcionari"];
        cards.forEach((card, idx) => {
            const isDone = isReallyCompleted || flippedIndices.includes(idx) || state.godMode;
            const flipClass = isDone ? 'flipped' : '';
            let tempDiv = document.createElement("div");
            try {
                if (typeof card.resposta === 'object') tempDiv.innerHTML = parseStrapiRichText(card.resposta);
                else tempDiv.innerHTML = card.resposta;
            } catch (e) { tempDiv.innerText = String(card.resposta); }
            let answerText = (tempDiv.innerText || tempDiv.textContent || "").trim().replace(/\s\s+/g, ' ');
            let words = answerText.split(" ");
            let targetWord = "", hiddenIndex = -1;
            for (let i = 0; i < words.length; i++) {
                let clean = words[i].replace(/[.,;:"'()]/g, '');
                if (clean.length > 4) { targetWord = words[i]; hiddenIndex = i; break; }
            }
            if(hiddenIndex === -1 && words.length > 0) { targetWord = words[words.length-1]; hiddenIndex = words.length-1; }
            let targetClean = targetWord.replace(/[.,;:"'()]/g, '');
            let options = [targetClean];
            while(options.length < 3) {
                let rand = distractors[Math.floor(Math.random() * distractors.length)];
                if(!options.includes(rand) && rand.toLowerCase() !== targetClean.toLowerCase()) options.push(rand);
            }
            options.sort(() => Math.random() - 0.5);
            let backContent = '';
            if (isDone) {
                backContent = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%;"><i class="fa-solid fa-check-circle" style="font-size:2.5rem; color:#fff; margin-bottom:10px;"></i><p style="font-size:1rem; color:white; font-weight:bold;">${answerText}</p></div>`;
            } else {
                let questionText = words.map((w, i) => i === hiddenIndex ? `<span class="cloze-blank">_______</span>` : w).join(" ");
                let buttonsHtml = options.map(opt => `<button class="btn-flash-option" data-selected="${encodeURIComponent(opt)}" data-correct="${encodeURIComponent(targetClean)}" data-idx="${idx}" data-mod="${modIdx}" data-total="${cards.length}" onclick="checkFlashcardFromDOM(event, this)">${opt}</button>`).join('');
                backContent = `<div class="flashcard-game-container"><div class="flashcard-question-text">${questionText}</div><div class="flashcard-options">${buttonsHtml}</div></div>`;
            }
            const clickAttr = `onclick="handleFlip(this)"`; 
            html += `<div class="flashcard ${flipClass}" ${clickAttr}><div class="flashcard-inner"><div class="flashcard-front"><h4>Targeta ${idx + 1}</h4><div class="flashcard-front-text">${card.pregunta}</div><small>${isDone ? '✅ Completada' : '<i class="fa-solid fa-rotate"></i> Clic per jugar'}</small></div><div class="flashcard-back">${backContent}</div></div></div>`;
        });
        html += `</div>`;
        container.innerHTML = html;
    }

    window.handleFlip = function(cardElement) { cardElement.classList.toggle('flipped'); }

    window.checkFlashcardFromDOM = function(e, btn) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        const selected = decodeURIComponent(btn.getAttribute('data-selected'));
        const correct = decodeURIComponent(btn.getAttribute('data-correct'));
        const cardIdx = parseInt(btn.getAttribute('data-idx'));
        const modIdx = parseInt(btn.getAttribute('data-mod'));
        const totalCards = parseInt(btn.getAttribute('data-total'));
        const count = addFlippedCard(modIdx, cardIdx);
        const counterEl = document.getElementById('fc-counter-text');
        if (counterEl) counterEl.innerText = `${count}/${totalCards}`;
        const container = btn.closest('.flashcard-game-container');
        const blankSpan = container.querySelector('.cloze-blank');
        const buttons = container.querySelectorAll('.btn-flash-option');
        buttons.forEach(b => b.disabled = true);
        if (selected.toLowerCase() === correct.toLowerCase()) {
            btn.classList.add('correct');
            if(blankSpan) { blankSpan.innerText = selected; blankSpan.classList.remove('cloze-blank'); blankSpan.classList.add('cloze-blank', 'filled-correct'); }
            btn.innerHTML = `✅ ${btn.innerText}`;
        } else {
            btn.classList.add('wrong');
            if(blankSpan) { blankSpan.innerText = selected; blankSpan.classList.add('filled-wrong'); }
            btn.innerHTML = `❌ ${btn.innerText}`;
        }
        if (count >= totalCards) {
            const headerContainer = document.getElementById('fc-header-container');
            if (headerContainer) headerContainer.innerHTML = `<div class="alert-info" style="margin-bottom:15px; color:green; background:#d4edda; border:1px solid #c3e6cb; padding:15px; border-radius:4px;"><i class="fa-solid fa-check-circle"></i> <strong>Activitat Completada!</strong><br><small>Ja pots accedir al següent mòdul (si has aprovat el test).</small></div>`;
            actualizarProgresoFlashcards(modIdx);
        }
    };

    function actualizarProgresoFlashcards(modIdx) {
        if (!state.progreso.modulos) state.progreso.modulos = [];
        if (!state.progreso.modulos[modIdx]) state.progreso.modulos[modIdx] = { aprobado:false, nota:0, intentos:0, flashcards_done: false };
        if (!state.progreso.modulos[modIdx].flashcards_done) {
            state.progreso.modulos[modIdx].flashcards_done = true;
            guardarProgreso(state.progreso).then(() => { verificarFinModulo(modIdx); renderSidebar(); });
        }
    }

    // 9. LOGICA TESTS
    function renderTestIntro(container, mod, modIdx) { 
        const progreso = (state.progreso.modulos && state.progreso.modulos[modIdx]) ? state.progreso.modulos[modIdx] : { aprobado: false, intentos: 0, nota: 0 };
        if (progreso.aprobado) {
             container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid green; text-align:center;"><h2 style="color:green">Test Superat! ✅</h2><div style="font-size:3rem; margin:20px 0;">${progreso.nota}</div><div class="btn-centered-container"><button class="btn-primary" onclick="revisarTest(${modIdx})">Veure resultats anteriors</button></div></div>`;
             return;
        }
        if (progreso.intentos >= 2 && !state.godMode) {
             container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid red; text-align:center;"><h2 style="color:red">Bloquejat ⛔</h2><p>Has esgotat els 2 intents.</p></div>`;
             return;
        }
        let labelIntent = `Intent: ${progreso.intentos + 1} de 2.`;
        if (progreso.intentos >= 2) labelIntent = `Intent: ${progreso.intentos + 1} (Mode Professor)`;
        container.innerHTML = `<div class="dashboard-card" style="text-align:center; padding: 40px;"><h2>📝 Test d'Avaluació</h2><div class="exam-info-box"><p>✅ <strong>Aprovat:</strong> 70% d'encerts.</p><p>🔄 <strong>${labelIntent}</strong></p></div><br><div class="btn-centered-container"><button class="btn-primary" onclick="iniciarTest()">COMENÇAR EL TEST</button></div></div>`;
    }
    window.iniciarTest = function() { state.testEnCurso = true; renderMainContent(); }

    function renderTestQuestions(container, mod, modIdx) {
        if (!state.preguntasSesionActual || state.preguntasSesionActual.length === 0) {
            state.preguntasSesionActual = prepararExamen(mod);
        }
        const preguntasActivas = state.preguntasSesionActual;
        window.currentQuestions = preguntasActivas; 
        const gridRight = document.getElementById('quiz-grid'); 
        gridRight.innerHTML = ''; gridRight.className = 'grid-container';
        preguntasActivas.forEach((p, i) => {
            const div = document.createElement('div'); div.className = 'grid-item'; div.id = `grid-q-${i}`; div.innerText = i + 1;
            div.onclick = () => document.getElementById(`card-q-${i}`).scrollIntoView({behavior:'smooth', block:'center'});
            if (state.respuestasTemp[`q-${i}`] !== undefined) div.classList.add('answered');
            gridRight.appendChild(div);
        });
        let html = `<h3>Test en Curs...</h3>`;
        preguntasActivas.forEach((preg, idx) => {
            const qId = `q-${idx}`;
            const isMulti = preg.es_multiresposta === true; 
            const typeLabel = isMulti ? '<span class="q-type-badge"><i class="fa-solid fa-list-check"></i> Multiresposta</span>' : '';
            const inputType = isMulti ? 'checkbox' : 'radio';
            if (state.godMode && state.respuestasTemp[qId] === undefined) {
                if (isMulti) {
                    state.respuestasTemp[qId] = preg.opcions.map((o, idx) => (o.esCorrecta || o.correct || o.isCorrect) ? idx : -1).filter(i => i !== -1);
                } else {
                    const correctIdx = preg.opcions.findIndex(o => o.esCorrecta || o.correct || o.isCorrect);
                    if (correctIdx !== -1) state.respuestasTemp[qId] = correctIdx;
                }
            }
            let savedVal = state.respuestasTemp[qId];
            if (isMulti && !Array.isArray(savedVal)) savedVal = [];
            html += `<div class="question-card" id="card-${qId}"><div class="q-header">Pregunta ${idx + 1} ${typeLabel}</div><div class="q-text">${preg.text}</div><div class="options-list">`;
            preg.opcions.forEach((opt, oIdx) => { 
                let isSelected = false;
                const valToStore = oIdx; 
                if (isMulti) isSelected = savedVal.includes(valToStore);
                else isSelected = (savedVal == valToStore);
                const checked = isSelected ? 'checked' : '';
                const selectedClass = isSelected ? 'selected' : '';
                const multiClass = isMulti ? 'multi-select' : '';
                html += `<div class="option-item ${selectedClass} ${multiClass}" onclick="selectTestOption('${qId}', ${valToStore}, ${isMulti}, 'test_mod_${modIdx}')"><input type="${inputType}" name="${qId}" ${checked}><span>${opt.text}</span></div>`; 
            });
            html += `</div></div>`;
        });
        const btnText = state.godMode ? "⚡ PROFESSOR: ENTREGAR ARA" : "FINALITZAR I ENTREGAR";
        html += `<div class="btn-centered-container"><button class="btn-primary" onclick="entregarTest(${modIdx})">${btnText}</button></div>`;
        container.innerHTML = html;
    }

    window.selectTestOption = function(qId, valId, isMulti, storageKeyType) {
        let currentVal = state.respuestasTemp[qId];
        if (isMulti) {
            if (!Array.isArray(currentVal)) currentVal = [];
            if (currentVal.includes(valId)) currentVal = currentVal.filter(v => v !== valId);
            else currentVal.push(valId);
            state.respuestasTemp[qId] = currentVal;
        } else {
            state.respuestasTemp[qId] = valId;
        }
        renderSelectionUpdate(qId, state.respuestasTemp[qId], isMulti);
        const gridIdx = qId.split('-')[1]; 
        const hasAnswer = isMulti ? state.respuestasTemp[qId].length > 0 : state.respuestasTemp[qId] !== undefined;
        const gridItemId = storageKeyType.includes('examen') ? `grid-final-q-${gridIdx}` : `grid-q-${gridIdx}`;
        const gridItem = document.getElementById(gridItemId); 
        if(gridItem) { if (hasAnswer) gridItem.classList.add('answered'); else gridItem.classList.remove('answered'); }
        guardarRespuestaLocal(storageKeyType, qId, state.respuestasTemp[qId]);
    };

    function renderSelectionUpdate(qId, value, isMulti) {
        const viewName = state.currentView;
        const modIdx = state.currentModuleIndex;
        const container = document.getElementById('moduls-container');
        if (viewName === 'test') renderTestQuestions(container, state.curso.moduls[modIdx], modIdx);
        else if (viewName === 'examen_final') renderFinalQuestions(container, state.respuestasTemp);
    }

    window.entregarTest = function(modIdx) {
        window.mostrarModalConfirmacion("Entregar Test", "Estàs segur?", async () => {
            document.getElementById('custom-modal').style.display = 'none';
            const preguntas = window.currentQuestions; 
            let aciertos = 0;
            preguntas.forEach((preg, idx) => { 
                const qId = `q-${idx}`;
                const userRes = state.respuestasTemp[qId];
                if (preg.es_multiresposta) {
                    const userArr = userRes || [];
                    const correctas = preg.opcions.map((o,i) => (o.esCorrecta || o.correct || o.isCorrect) ? i : -1).filter(i => i !== -1);
                    const isCorrect = (userArr.length === correctas.length) && userArr.every(val => correctas.includes(val));
                    if (isCorrect) aciertos++;
                } else {
                    const selectedOpt = preg.opcions[userRes];
                    if (selectedOpt && (selectedOpt.esCorrecta || selectedOpt.correct || selectedOpt.isCorrect)) aciertos++;
                }
            });
            const nota = parseFloat(((aciertos / preguntas.length) * 10).toFixed(2)); 
            const aprobado = nota >= 7.0;
            if (!state.progreso.modulos[modIdx]) state.progreso.modulos[modIdx] = { intentos: 0, nota: 0, aprobado: false, flashcards_done: false };
            state.progreso.modulos[modIdx].intentos += 1; 
            state.progreso.modulos[modIdx].nota = Math.max(state.progreso.modulos[modIdx].nota, nota); 
            if (aprobado) state.progreso.modulos[modIdx].aprobado = true;
            
            try {
                const payload = { data: { progres_detallat: state.progreso } }; 
                const res = await fetch(`${STRAPI_URL}/api/matriculas/${state.matriculaId}`, { 
                    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }, body: JSON.stringify(payload) 
                });
                const json = await res.json();
                if (json.data && json.data.progres_detallat) { state.progreso = json.data.progres_detallat; }
                else if (json.data && json.data.attributes && json.data.attributes.progres_detallat) { state.progreso = json.data.attributes.progres_detallat; }
                if (aprobado) verificarFinModulo(modIdx);
                else if (state.progreso.modulos[modIdx].intentos < 2) crearNotificacion("Has d'estudiar una mica més 📖", `Has tret un ${nota}. Et queda 1 intent.`);
            } catch(e) { console.error(e); }
            limpiarRespuestasLocales(`test_mod_${modIdx}`); 
            state.testEnCurso = false; 
            document.body.classList.remove('exam-active');
            mostrarFeedback(preguntas, state.respuestasTemp, nota, aprobado, modIdx, false);
        });
    }

    function mostrarFeedback(preguntas, respuestasUsuario, nota, aprobado, modIdx, esFinal) {
        const container = document.getElementById('moduls-container'); const color = aprobado ? 'green' : 'red';
        let action = `window.cambiarVista(${esFinal ? 999 : modIdx}, '${esFinal ? 'examen_final' : 'test'}')`;
        if (esFinal && aprobado) action = "window.location.reload()";

        // GRID RESULTADOS CON COLORES (FIX V57.10)
        const gridRight = document.getElementById('quiz-grid'); 
        if (gridRight) {
            gridRight.className = 'grid-container'; 
            gridRight.innerHTML = ''; 
            
            preguntas.forEach((p, i) => { 
                const qId = esFinal ? `final-${i}` : `q-${i}`; 
                const userRes = respuestasUsuario[qId];
                let esCorrecta = false;
                if (p.es_multiresposta) {
                    const userArr = userRes || [];
                    const correctas = p.opcions.map((o, idx) => (o.esCorrecta || o.correct || o.isCorrect) ? idx : -1).filter(idx => idx !== -1);
                    const u = userArr.sort().toString();
                    const c = correctas.sort().toString();
                    esCorrecta = (u === c);
                } else {
                    const selectedOpt = p.opcions[userRes];
                    if (selectedOpt && (selectedOpt.esCorrecta || selectedOpt.correct || selectedOpt.isCorrect)) esCorrecta = true;
                }
                const div = document.createElement('div'); div.className = 'grid-item'; div.innerText = i + 1; 
                div.style.backgroundColor = esCorrecta ? '#28a745' : '#dc3545'; div.style.color = 'white';
                div.onclick = () => { const card = document.getElementById(esFinal ? `review-card-final-${i}` : `review-card-${i}`); if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }; 
                gridRight.appendChild(div); 
            });
        }

        let html = `<div class="dashboard-card" style="border-top:5px solid ${color}; text-align:center; margin-bottom:30px;">
            <h2 style="color:${color}">${aprobado ? 'Superat!' : 'No Superat'}</h2>
            <div style="font-size:4rem; font-weight:bold; margin:10px 0;">${nota}</div>
            <div class="btn-centered-container"><button class="btn-primary" onclick="${action}">Continuar</button></div>
        </div><h3>Revisió:</h3>`;
        
        preguntas.forEach((preg, idx) => {
            const qId = esFinal ? `final-${idx}` : `q-${idx}`; 
            const cardId = esFinal ? `review-card-final-${idx}` : `review-card-${idx}`;
            const userRes = respuestasUsuario[qId];
            const isMulti = preg.es_multiresposta === true;
            const typeLabel = isMulti ? '<span class="q-type-badge"><i class="fa-solid fa-list-check"></i> Multiresposta</span>' : '';
            html += `<div class="question-card review-mode" id="${cardId}"><div class="q-header">Pregunta ${idx + 1} ${typeLabel}</div><div class="q-text">${preg.text}</div><div class="options-list">`;
            preg.opcions.forEach((opt, oIdx) => {
                let classes = 'option-item '; const isCorrect = opt.esCorrecta === true || opt.isCorrect === true || opt.correct === true;
                let isSelected = false;
                const valToCheck = oIdx;
                if (isMulti) isSelected = (userRes || []).includes(valToCheck);
                else isSelected = (userRes == valToCheck);
                if (isCorrect) classes += 'correct-answer '; 
                if (isSelected) { classes += 'selected '; if (!isCorrect) classes += 'user-wrong '; }
                const inputType = isMulti ? 'checkbox' : 'radio';
                const checked = isSelected ? 'checked' : '';
                html += `<div class="${classes}"><input type="${inputType}" ${checked} disabled><span>${opt.text}</span></div>`;
            });
            if (preg.explicacio) html += `<div class="explanation-box"><strong>Info:</strong><br>${parseStrapiRichText(preg.explicacio)}</div>`;
            html += `</div></div>`;
        });
        container.innerHTML = html; window.scrollTo(0,0);
    }

    // 10. REVISIÓN POSTERIOR (FIXED GRID UI)
    window.revisarTest = function(modIdx) {
        const mod = state.curso.moduls[modIdx];
        const todasLasPreguntas = mod.banc_preguntes || [];
        if (todasLasPreguntas.length === 0) { console.warn("No preguntes."); return; }
        const container = document.getElementById('moduls-container');
        
        // GRID REVISIÓN LIMPIO (SIN TEXTO FEO)
        const gridRight = document.getElementById('quiz-grid'); 
        if (gridRight) {
            gridRight.className = 'grid-container'; 
            gridRight.innerHTML = ''; 
            todasLasPreguntas.forEach((p, i) => { 
                const div = document.createElement('div'); 
                div.className = 'grid-item answered'; // Azul neutro
                div.innerText = i + 1; 
                div.onclick = () => { const card = document.getElementById(`review-card-${i}`); if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }; 
                gridRight.appendChild(div); 
            });
        }
        
        let html = `<h3>Revisió (Mode Estudi)</h3><div class="alert-info" style="margin-bottom:20px; background:#e8f0fe; padding:15px; border-radius:6px; color:#0d47a1;"><i class="fa-solid fa-eye"></i> Aquí pots veure totes les preguntes del banc amb les respostes correctes per repassar.</div>`;
        todasLasPreguntas.forEach((preg, idx) => {
            const isMulti = preg.es_multiresposta === true;
            const typeLabel = isMulti ? '<span class="q-type-badge"><i class="fa-solid fa-list-check"></i> Multiresposta</span>' : '';
            const inputType = isMulti ? 'checkbox' : 'radio';
            html += `<div class="question-card review-mode" id="review-card-${idx}"><div class="q-header">Pregunta ${idx + 1} ${typeLabel}</div><div class="q-text">${preg.text}</div><div class="options-list">`;
            preg.opcions.forEach((opt, oIdx) => {
                let classes = 'option-item '; const isCorrect = opt.esCorrecta === true || opt.isCorrect === true || opt.correct === true;
                if (isCorrect) classes += 'correct-answer ';
                html += `<div class="${classes}"><input type="${inputType}" disabled ${isCorrect ? 'checked' : ''}><span>${opt.text}</span></div>`;
            });
            if (preg.explicacio) html += `<div class="explanation-box"><strong>Info:</strong><br>${parseStrapiRichText(preg.explicacio)}</div>`;
            html += `</div></div>`;
        });
        html += `<div class="btn-centered-container"><button class="btn-primary" onclick="window.cambiarVista(${modIdx}, 'test')">Tornar</button></div>`;
        container.innerHTML = html; window.scrollTo(0,0);
    }

    // 11. EXAMEN FINAL (FIXED CONST ERROR & GRID UI)
    function renderExamenFinal(container) {
        if (!state.progreso.examen_final) state.progreso.examen_final = { aprobado: false, nota: 0, intentos: 0 };
        const finalData = state.progreso.examen_final;
        
        if (finalData.aprobado) {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            // 1. Obtenir dates clau (Matrícula i Inici de curs) des de l'estat global
            const tMatricula = state.matriculaCreatedAt ? new Date(state.matriculaCreatedAt).getTime() : hoy.getTime();
            const rawInicio = state.curso.data_inici || state.curso.fecha_inicio || state.curso.publishedAt;
            const tInicio = new Date(rawInicio).getTime();

            // 2. Calculem els 14 dies des de la data més TARDANA (Inici o Matrícula)
            let fechaDesbloqueo = new Date(Math.max(tMatricula, tInicio));
            fechaDesbloqueo.setDate(fechaDesbloqueo.getDate() + 14);
            fechaDesbloqueo.setHours(0, 0, 0, 0);
            
            // 3. REGLA MESTRA: El final de curs allibera el títol automàticament
            const rawFin = state.curso.data_fi || state.curso.fecha_fin;
            if (rawFin) {
                const fechaFinCurso = new Date(rawFin);
                if (!isNaN(fechaFinCurso.getTime()) && fechaFinCurso < fechaDesbloqueo) {
                    fechaDesbloqueo = fechaFinCurso;
                }
            }

            const estaBloqueado = hoy < fechaDesbloqueo;
            let botonHtml = '';

            if (estaBloqueado) {
                // SI ESTÀ BLOQUEJAT: Mostrem avís de temps de permanència
                const fechaStr = fechaDesbloqueo.toLocaleDateString('ca-ES');
                botonHtml = `
                    <div class="alert-info" style="margin-top:15px; background:#fff3cd; color:#856404; border:1px solid #ffeeba; padding:15px; border-radius:6px; font-size:0.9rem; text-align:left;">
                        <i class="fa-solid fa-clock"></i> <strong>Certificat en procés d'emissió.</strong><br>
                        Seguint la normativa de permanència mínima, el teu diploma estarà disponible el dia <strong>${fechaStr}</strong>.
                    </div>`;
            } else {
                // SI TOT ÉS CORRECTE: Mostrem el botó vermell de descàrrega
                botonHtml = `<button class="btn-primary" onclick="window.imprimirDiploma('${finalData.nota}')"><i class="fa-solid fa-download"></i> Descarregar Diploma</button>`;
            }

            // Botó de revisió (sempre visible)
            let revisarHtml = `<button class="btn-secondary" style="margin-top:10px;" onclick="revisarExamenFinal()"><i class="fa-solid fa-eye"></i> Revisar Respostes</button>`;

            container.innerHTML = `
                <div class="dashboard-card" style="border-top:5px solid green; text-align:center;">
                    <h1 style="color:green;">🎉 ENHORABONA!</h1>
                    <p>Has superat l'avaluació final amb èxit.</p>
                    <div style="font-size:3.5rem; font-weight:bold; margin:20px 0; color:var(--brand-blue);">${finalData.nota}</div>
                    <div class="btn-centered-container" style="flex-direction:column; gap:10px; align-items:center;">
                        ${botonHtml}
                        ${revisarHtml}
                    </div>
                </div>`;
            return;
        }
        
        if (finalData.intentos >= 2 && !state.godMode) { 
            container.innerHTML = `<div class="dashboard-card" style="border-top:5px solid red; text-align:center;"><h2 style="color:red">🚫 Bloquejat</h2><p>Intents esgotats.</p></div>`; 
            return; 
        }
        const savedData = cargarRespuestasLocales('examen_final');
        const isActive = (Object.keys(savedData).length > 0) || state.testEnCurso;
        if (isActive) { state.testEnCurso = true; renderFinalQuestions(container, savedData); } 
        else { container.innerHTML = `<div class="dashboard-card" style="text-align:center; padding: 40px;"><h2 style="color:var(--brand-blue);">🏆 Examen Final</h2><div class="exam-info-box"><p>⏱️ 30 minuts.</p><p>🎯 Nota tall: 7.5</p><p>🔄 Intents: ${finalData.intentos}/2</p></div><br><div class="btn-centered-container"><button class="btn-primary" onclick="iniciarExamenFinal()">COMENÇAR EXAMEN FINAL</button></div></div>`; }
    }

    window.iniciarExamenFinal = function() {
        if (!state.curso.examen_final || state.curso.examen_final.length === 0) { alert("Error: No s'han carregat preguntes."); return; }
        state.preguntasExamenFinal = [...state.curso.examen_final].sort(() => 0.5 - Math.random());
        const orderIds = state.preguntasExamenFinal.map(p => p.id || p.documentId); 
        localStorage.setItem(`sicap_exam_order_${USER.id}_${SLUG}`, JSON.stringify(orderIds));
        state.testEnCurso = true; state.testStartTime = Date.now(); localStorage.setItem(`sicap_timer_start_${USER.id}_${SLUG}`, state.testStartTime);
        state.respuestasTemp = {}; renderExamenFinal(document.getElementById('moduls-container'));
    }

    function renderFinalQuestions(container, savedData) {
        const storedOrder = JSON.parse(localStorage.getItem(`sicap_exam_order_${USER.id}_${SLUG}`));
        if (storedOrder && state.curso.examen_final) { state.preguntasExamenFinal = []; storedOrder.forEach(id => { const found = state.curso.examen_final.find(p => (p.id || p.documentId) === id); if(found) state.preguntasExamenFinal.push(found); }); if(state.preguntasExamenFinal.length === 0) state.preguntasExamenFinal = state.curso.examen_final; } else if (state.preguntasExamenFinal.length === 0) { state.preguntasExamenFinal = state.curso.examen_final; }
        const storedStartTime = localStorage.getItem(`sicap_timer_start_${USER.id}_${SLUG}`); if(storedStartTime) state.testStartTime = parseInt(storedStartTime); else { state.testStartTime = Date.now(); localStorage.setItem(`sicap_timer_start_${USER.id}_${SLUG}`, state.testStartTime); }
        const gridRight = document.getElementById('quiz-grid'); gridRight.className = ''; gridRight.innerHTML = `<div id="exam-timer-container"><div id="exam-timer" class="timer-box">30:00</div></div><div id="grid-inner-numbers"></div>`; iniciarCronometro();
        const gridInner = document.getElementById('grid-inner-numbers');
        
        state.preguntasExamenFinal.forEach((p, i) => {
            const div = document.createElement('div'); div.className = 'grid-item'; div.id = `grid-final-q-${i}`; div.innerText = i + 1;
            div.onclick = () => document.getElementById(`card-final-${i}`).scrollIntoView({behavior:'smooth', block:'center'});
            if (state.respuestasTemp[`final-${i}`] !== undefined || (savedData && savedData[`final-${i}`] !== undefined)) div.classList.add('answered');
            gridInner.appendChild(div);
        });
        
        if(savedData) state.respuestasTemp = savedData;
        let html = `<h3 style="color:var(--brand-red);">Examen Final en Curs...</h3>`;
        state.preguntasExamenFinal.forEach((preg, idx) => {
            const qId = `final-${idx}`;
            const isMulti = preg.es_multiresposta === true;
            const typeLabel = isMulti ? '<span class="q-type-badge"><i class="fa-solid fa-list-check"></i> Multiresposta</span>' : '';
            const inputType = isMulti ? 'checkbox' : 'radio';
            if (state.godMode && state.respuestasTemp[qId] === undefined) {
                if (isMulti) {
                    state.respuestasTemp[qId] = preg.opcions.map((o, idx) => (o.esCorrecta || o.correct || o.isCorrect) ? idx : -1).filter(i => i !== -1);
                } else {
                    const correctIdx = preg.opcions.findIndex(o => o.esCorrecta || o.correct || o.isCorrect);
                    if (correctIdx !== -1) state.respuestasTemp[qId] = correctIdx;
                }
            }
            let savedVal = state.respuestasTemp[qId];
            if (isMulti && !Array.isArray(savedVal)) savedVal = [];
            html += `<div class="question-card" id="card-final-${idx}"><div class="q-header">Pregunta ${idx + 1} ${typeLabel}</div><div class="q-text" style="margin-top:10px;">${preg.text}</div><div class="options-list">`;
            preg.opcions.forEach((opt, oIdx) => { 
                let isSelected = false;
                const valToStore = oIdx; 
                if (isMulti) isSelected = savedVal.includes(valToStore);
                else isSelected = (savedVal == valToStore);
                const checked = isSelected ? 'checked' : '';
                const selectedClass = isSelected ? 'selected' : '';
                const multiClass = isMulti ? 'multi-select' : '';
                html += `<div class="option-item ${selectedClass} ${multiClass}" onclick="selectTestOption('${qId}', ${valToStore}, ${isMulti}, 'examen_final')"><input type="${inputType}" name="${qId}" ${checked}><span>${opt.text}</span></div>`; 
            });
            html += `</div></div>`;
        });
        const btnText = state.godMode ? "⚡ PROFESSOR: ENTREGAR ARA" : "ENTREGAR EXAMEN FINAL";
        html += `<div class="btn-centered-container"><button class="btn-primary" onclick="entregarExamenFinal()">${btnText}</button></div>`;
        container.innerHTML = html; window.currentQuestions = state.preguntasExamenFinal;
    }

    function iniciarCronometro() { const display = document.getElementById('exam-timer'); if(!display) return; const LIMIT_MS = 30 * 60 * 1000; clearInterval(state.timerInterval); state.timerInterval = setInterval(() => { const now = Date.now(); const elapsed = now - state.testStartTime; const remaining = LIMIT_MS - elapsed; if (remaining <= 0) { detenerCronometro(); display.innerText = "00:00"; alert("Temps esgotat!"); entregarExamenFinal(true); return; } const min = Math.floor(remaining / 60000); const sec = Math.floor((remaining % 60000) / 1000); display.innerText = `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`; }, 1000); }
    function detenerCronometro() { clearInterval(state.timerInterval); }
    
    window.entregarExamenFinal = function(forzado = false) {
        const doDelivery = async () => {
            detenerCronometro(); const preguntas = window.currentQuestions; let aciertos = 0;
            preguntas.forEach((preg, idx) => { 
                const qId = `final-${idx}`; 
                const userRes = state.respuestasTemp[qId];
                if (preg.es_multiresposta) {
                    const userArr = userRes || [];
                    const correctas = preg.opcions.map((o,i) => (o.esCorrecta || o.correct || o.isCorrect) ? i : -1).filter(i => i !== -1);
                    const isCorrect = (userArr.length === correctas.length) && userArr.every(val => correctas.includes(val));
                    if (isCorrect) aciertos++;
                } else {
                    const selectedOpt = preg.opcions[userRes];
                    if (selectedOpt && (selectedOpt.esCorrecta || selectedOpt.correct || selectedOpt.isCorrect)) aciertos++;
                }
            });
            const nota = parseFloat(((aciertos / preguntas.length) * 10).toFixed(2)); const aprobado = nota >= 7.5; 
            
            if (!state.progreso.examen_final) state.progreso.examen_final = { intentos: 0, nota: 0, aprobado: false };
            state.progreso.examen_final.intentos += 1; 
            state.progreso.examen_final.nota = Math.max(state.progreso.examen_final.nota, nota); 
            if (aprobado) state.progreso.examen_final.aprobado = true;
            
            let porcentaje = state.progreso.progres || 0;
            if (aprobado) porcentaje = 100;
            
            const payload = { data: { progres_detallat: state.progreso, progres: porcentaje } }; 
            
            if (aprobado) { 
                payload.data.estat = 'completat'; 
                payload.data.nota_final = nota; 
                notificarAprobado(state.curso.titol);
            } else {
                const intentosGastados = state.progreso.examen_final.intentos;
                const intentosRestantes = 2 - intentosGastados;
                if (intentosRestantes > 0) crearNotificacion("Examen Final No Superat ⚠️", `Has tret un ${nota}. Et queda ${intentosRestantes} intent.`);
                else crearNotificacion("Intents Esgotats ⛔", `Has esgotat els 2 intents amb un ${nota}.`);
            }
            
            try {
                const res = await fetch(`${STRAPI_URL}/api/matriculas/${state.matriculaId}`, { 
                    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }, body: JSON.stringify(payload) 
                });
                const json = await res.json();
                if (json.data && json.data.progres_detallat) { state.progreso = json.data.progres_detallat; }
                else if (json.data && json.data.attributes && json.data.attributes.progres_detallat) { state.progreso = json.data.attributes.progres_detallat; }
            } catch (e) { console.error("Error guardant examen:", e); }
            
            limpiarRespuestasLocales('examen_final'); 
            state.testEnCurso = false; 
            document.body.classList.remove('exam-active');
            
            mostrarFeedback(preguntas, state.respuestasTemp, nota, aprobado, 999, true);
        };

        if(forzado) { doDelivery(); } 
        else { 
            window.mostrarModalConfirmacion("Entregar Examen", "Segur que vols entregar?", () => { 
                document.getElementById('custom-modal').style.display = 'none'; 
                doDelivery(); 
            }); 
        }
    }

    // REVISIÓN EXAMEN FINAL (FIX GRID UI)
    window.revisarExamenFinal = function() {
        const container = document.getElementById('moduls-container');
        const preguntas = state.curso.examen_final || [];
        if (preguntas.length === 0) { alert("No s'han trobat preguntes."); return; }
        
        const gridRight = document.getElementById('quiz-grid'); 
        if (gridRight) {
            gridRight.className = 'grid-container'; 
            gridRight.innerHTML = ''; 
            // SIN TEXTO FEO
            preguntas.forEach((p, i) => { 
                const div = document.createElement('div'); div.className = 'grid-item answered'; div.innerText = i + 1; 
                div.onclick = () => { const card = document.getElementById(`review-card-final-${i}`); if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }; 
                gridRight.appendChild(div); 
            });
        }
        let html = `<h3>Revisió Examen Final</h3><div class="alert-info" style="margin-bottom:20px; background:#e8f0fe; padding:15px; border-radius:6px;"><i class="fa-solid fa-eye"></i> Mode lectura.</div>`;
        preguntas.forEach((preg, idx) => {
            html += `<div class="question-card review-mode" id="review-card-final-${idx}"><div class="q-header">Pregunta ${idx + 1}</div><div class="q-text">${preg.text}</div><div class="options-list">`;
            preg.opcions.forEach((opt) => {
                let classes = 'option-item '; const isCorrect = opt.esCorrecta === true || opt.isCorrect === true || opt.correct === true;
                if (isCorrect) classes += 'correct-answer '; 
                html += `<div class="${classes}"><input type="radio" disabled ${isCorrect ? 'checked' : ''}><span>${opt.text}</span></div>`;
            });
            if (preg.explicacio) html += `<div class="explanation-box"><strong>Explicació:</strong><br>${parseStrapiRichText(preg.explicacio)}</div>`;
            html += `</div></div>`;
        });
        html += `<div class="btn-centered-container"><button class="btn-primary" onclick="window.cambiarVista(999, 'examen_final')">Tornar</button></div>`;
        container.innerHTML = html; window.scrollTo(0,0);
    }

    // UTILS
    window.imprimirDiploma = function(nota) { 
        if (window.imprimirDiplomaCompleto) {
            const matData = { id: state.matriculaId, documentId: state.matriculaId, nota_final: nota, progres_detallat: state.progreso };
            window.imprimirDiplomaCompleto(matData, state.curso);
        } else { alert("Error: Mòdul de certificació no carregat."); }
    };

    window.isDoubtSubmitting = false;
    window.obrirFormulariDubte = function(moduloTitulo) {
        const modal = document.getElementById('custom-modal');
        const titleEl = document.getElementById('modal-title');
        const msgEl = document.getElementById('modal-msg');
        const btnConfirm = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');
        titleEl.innerText = "Enviar Dubte";
        titleEl.style.color = "var(--brand-blue)";
        msgEl.innerHTML = `<div style="padding: 5px 0;"><p style="margin-bottom:10px; color:var(--text-main);">Escriu la teva pregunta sobre: <strong>${moduloTitulo}</strong></p><textarea id="modal-doubt-text" class="modal-textarea" placeholder="Explica el teu dubte detalladament..."></textarea><small style="color:#666; display:flex; align-items:center; gap:5px;"><i class="fa-regular fa-bell"></i> El professor rebrà una notificació instantània.</small></div>`;
        btnCancel.style.display = 'block';
        btnConfirm.innerText = "Enviar";
        btnConfirm.disabled = false;
        btnConfirm.style.background = "var(--brand-blue)";
        const newConfirm = btnConfirm.cloneNode(true);
        const newCancel = btnCancel.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);
        newCancel.onclick = () => { modal.style.display = 'none'; window.isDoubtSubmitting = false; };
        
        newConfirm.onclick = async () => {
            if (window.isDoubtSubmitting) return; 
            const textEl = document.getElementById('modal-doubt-text');
            const text = textEl.value.trim();
            if(!text) { textEl.style.borderColor = "red"; textEl.focus(); return; }
            window.isDoubtSubmitting = true;
            newConfirm.innerText = "Enviant...";
            newConfirm.disabled = true;
            try {
                const payload = { data: { missatge: text, tema: moduloTitulo, curs: state.curso.titol, alumne_nom: localStorage.getItem('user_fullname') || USER.username, users_permissions_user: USER.id, estat: 'pendent', data_envio: new Date().toISOString() } };
                const res = await fetch(`${STRAPI_URL}/api/missatges`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }, body: JSON.stringify(payload) });
                if(res.ok) {
                    modal.style.display = 'none';
                    if(window.mostrarModalError) window.mostrarModalError("✅ Dubte enviat correctament!"); else alert("Dubte enviat correctament!");
                } else { throw new Error("API Error: " + res.status); }
            } catch(e) { 
                console.error(e); modal.style.display = 'none'; 
                if(window.mostrarModalError) window.mostrarModalError("Error al connectar amb el servidor."); else alert("Error al connectar.");
            } finally { window.isDoubtSubmitting = false; }
        };
        modal.style.display = 'flex';
    };

    window.tornarAlDashboard = function() { window.location.href = 'index.html'; };
});