const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby5eI8b_EJ1eFIlQfujBhwgmgHmhrsGSwQRQEO3p7rgaBNrHZcZXrud2DbZrr1s4ne63g/exec"; 

let nodosData = [];
let aportesData = [];
let conexionesData = [];
let nodoActivoId = null;
const NODO_INICIAL_ID = "N-001";
const NODO_FRECUENCIA_ID = "N-002";
const NODO_APERTURA_ID = "N-003";
const META_AUDIOS = 10;
const META_VIDEOS = 15;
const MEMORIA_INICIO = "archivoExperienciaIniciada";
const MEMORIA_VIDEO = "archivoVideoInicialVisto";

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>'"]/g, caracter => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[caracter]));
}

function obtenerURLSegura(valor) {
    try {
        const url = new URL(valor);
        return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
    } catch (error) {
        return "#";
    }
}

function contarAudiosDeFrecuencia() {
    return aportesData.filter(aporte => String(aporte.idNodo) === NODO_FRECUENCIA_ID && String(aporte.tipo).toLowerCase() === "audio").length;
}

function rizomaDesbloqueado() {
    return contarVideosDelRizoma() >= META_VIDEOS;
}

function contarVideosDelRizoma() {
    return aportesData.filter(aporte => String(aporte.idNodo) === NODO_APERTURA_ID && String(aporte.tipo).toLowerCase() === "video").length;
}

function tercerNodoDesbloqueado() {
    const nodoApertura = nodosData.find(nodo => String(nodo.id) === NODO_APERTURA_ID);
    return nodoApertura && String(nodoApertura.estado).toLowerCase() === "unlocked";
}

function puedeVerMapa() {
    return videoInicialVisto() && contarAudiosDeFrecuencia() >= META_AUDIOS;
}

function experienciaIniciada() {
    return localStorage.getItem(MEMORIA_INICIO) === "true";
}

function videoInicialVisto() {
    return localStorage.getItem(MEMORIA_VIDEO) === "true";
}

function obtenerNodosVisibles() {
    if (!experienciaIniciada() || !videoInicialVisto()) return nodosData.filter(nodo => String(nodo.id) === NODO_INICIAL_ID);
    if (contarAudiosDeFrecuencia() < META_AUDIOS) return nodosData.filter(nodo => [NODO_INICIAL_ID, NODO_FRECUENCIA_ID].includes(String(nodo.id)));
    return nodosData;
}

document.addEventListener("DOMContentLoaded", async () => {
    configurarEventos();
    await cargarDatosDesdeDrive();
});

async function cargarDatosDesdeDrive() {
    const canvas = document.getElementById("rhizome-canvas");
    if (canvas) canvas.innerHTML = "<p style='text-align:center; width:100%; color:#fff;'>Sincronizando cartografía de la e-MEV...</p>";
    
    try {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=leerDatos`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        nodosData = data.nodos || [];
        aportesData = data.aportes || [];
        conexionesData = data.conexiones || [];
        
        aplicarProgresoLocal();
        renderizarNodos();
    } catch (error) {
        console.error("Fallo la conexión con Drive:", error);
    }
}

function aplicarProgresoLocal() {
    const progresoGuardado = localStorage.getItem("nodosDesbloqueados");
    if (progresoGuardado) {
        let nodosLiberadosLocal = [];
        try { nodosLiberadosLocal = JSON.parse(progresoGuardado); } catch (error) { localStorage.removeItem("nodosDesbloqueados"); }
        nodosLiberadosLocal.forEach(idLocal => {
            const nodoEnRed = nodosData.find(n => String(n.id) === String(idLocal));
            if (nodoEnRed) { nodoEnRed.estado = "unlocked"; }
        });
    }
    if (contarAudiosDeFrecuencia() >= META_AUDIOS) {
        const nodoApertura = nodosData.find(nodo => String(nodo.id) === NODO_APERTURA_ID);
        if (nodoApertura) nodoApertura.estado = "unlocked";
    }
}

async function enviarADrive(accion, payload) {
    if (GOOGLE_SCRIPT_URL === "") return true; 
    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({ accion: accion, datos: payload }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        if (!res.ok) return false;
        return (await res.json()).status === "success";
    } catch (e) {
        console.error("Error de transmisión:", e); return false;
    }
}

function actualizarSelectorPadres() {
    const select = document.getElementById("tema-padre");
    select.innerHTML = "";
    const bases = nodosData.filter(n => n.tema && n.tema.startsWith("BASE|||"));
    
    if (bases.length === 0) { select.add(new Option("No hay Temas Base aún.", "")); } 
    else {
        bases.forEach(b => {
            const partes = b.tema.split("|||");
            const color = partes[1]; const nombre = partes[2] || b.titulo;
            select.add(new Option(nombre, `${color}|||${nombre}`));
        });
    }
}

function actualizarGamificacion(totalAportes) {
    const btnFab = document.getElementById("btn-fab-crear");
    const subHeader = document.getElementById("estado-red-sub");
    const labelAportes = document.getElementById("contador-aportes");
    const cajaBase = document.getElementById("caja-base");
    const cajaSub = document.getElementById("caja-sub");
    const selectNivel = document.getElementById("nuevo-nivel");
    const alertaTema = document.getElementById("alerta-tema-bloqueado");

    const selectTipoNodo = document.getElementById("nuevo-tipo");
    const alertaVideoNodo = document.getElementById("alerta-video-nodo");
    const selectTipoAporte = document.getElementById("aporte-tipo");
    const alertaVideoAporte = document.getElementById("alerta-video-aporte");
    const faseRed = document.getElementById("fase-red");

    const audiosFrecuencia = contarAudiosDeFrecuencia();
    if (audiosFrecuencia >= META_AUDIOS) {
        const nodoApertura = nodosData.find(nodo => String(nodo.id) === NODO_APERTURA_ID);
        if (nodoApertura) nodoApertura.estado = "unlocked";
    }
    const videosRizoma = contarVideosDelRizoma();
    const expansionDesbloqueada = rizomaDesbloqueado();

    if (labelAportes) labelAportes.innerText = `${audiosFrecuencia}/${META_AUDIOS}`;
    const contadorVideos = document.getElementById("contador-videos");
    if (contadorVideos) contadorVideos.innerText = `${videosRizoma}/${META_VIDEOS}`;

    const nodoFrecuencia = nodosData.find(nodo => String(nodo.id) === NODO_FRECUENCIA_ID);
    const frecuenciaDesbloqueada = nodoFrecuencia && String(nodoFrecuencia.estado).toLowerCase() === "unlocked";

    if (subHeader) subHeader.style.display = "block";
    
    if (!frecuenciaDesbloqueada) {
        if (subHeader) { subHeader.innerText = "SISTEMA BLOQUEADO (FASE 01)"; subHeader.style.color = "var(--danger)"; }
        if (btnFab) btnFab.style.display = "none";
        if (labelAportes) labelAportes.style.color = "var(--text-muted)";
        if (faseRed) { faseRed.innerText = "Fase 01 · Mira el video y descifra la clave."; faseRed.style.color = "var(--danger)"; }
        
    } else if (audiosFrecuencia < META_AUDIOS) {
        if (subHeader) { subHeader.innerText = `SISTEMA RESTRINGIDO (Faltan ${META_AUDIOS - audiosFrecuencia} audios)`; subHeader.style.color = "#f59e0b"; }
        if (btnFab) btnFab.style.display = "none";
        if (labelAportes) labelAportes.style.color = "#f59e0b"; 
        if (faseRed) { faseRed.innerText = "Fase 02 · Reúne 10 audios para abrir Pedagogía crítica."; faseRed.style.color = "#f59e0b"; }
        
    } else if (videosRizoma < META_VIDEOS) {
        if (subHeader) { subHeader.innerText = `EL RIZOMA ESTÁ POR LIBERARSE (Faltan ${META_VIDEOS - videosRizoma} videos)`; subHeader.style.color = "#f59e0b"; }
        if (btnFab) btnFab.style.display = "none";
        if (labelAportes) labelAportes.style.color = "var(--primary)";
        if (faseRed) { faseRed.innerText = "Fase 03 · El rizoma está por liberarse. Aporta videos."; faseRed.style.color = "#f59e0b"; }
        
    } else {
        if (subHeader) { subHeader.innerText = "EL RIZOMA ESTABA RESTRINGIDO, PERO YA ES TOTALMENTE LIBRE"; subHeader.style.color = "var(--primary)"; }
        if (btnFab) btnFab.style.display = "block";
        if (labelAportes) labelAportes.style.color = "var(--primary)";
        if (faseRed) { faseRed.innerText = "Fase 04 · Rizoma libre. La comunidad ha roto la estructura oficial."; faseRed.style.color = "var(--primary)"; }

        if (selectNivel && selectNivel.querySelector("option[value='BASE']")) selectNivel.querySelector("option[value='BASE']").disabled = false;
        if (alertaTema) alertaTema.style.display = "none";

        if (selectTipoNodo && !selectTipoNodo.querySelector("option[value='Video']")) {
            const opt = document.createElement("option"); opt.value = "Video"; opt.text = "4. Video / Cortometraje (YouTube)"; selectTipoNodo.appendChild(opt);
        }
        if (alertaVideoNodo) alertaVideoNodo.innerText = "";
        if (alertaVideoAporte) alertaVideoAporte.style.display = "none";
    }
    
    if (selectNivel && selectNivel.querySelector("option[value='BASE']")) selectNivel.querySelector("option[value='BASE']").disabled = !expansionDesbloqueada;
    if (!expansionDesbloqueada && selectNivel && cajaBase && cajaSub) { 
        selectNivel.value = "SUB"; 
        cajaBase.style.display = "none"; 
        cajaSub.style.display = "block"; 
        if (alertaTema) alertaTema.style.display = "block"; 
    }
}

function renderizarNodos() {
    const canvas = document.getElementById("rhizome-canvas"); 
    if (!canvas) return;
    canvas.innerHTML = "";
    
    const totalAportes = aportesData.length;
    actualizarGamificacion(totalAportes);

    const nodosMostrados = [...obtenerNodosVisibles()].reverse(); 
    nodosMostrados.forEach(nodo => {
        let colorParaEtiqueta = "#a1a1aa";
        let textoEtiqueta = nodo.tipo;
        
        if (nodo.tema && nodo.tema.includes("|||")) {
            const partes = nodo.tema.split("|||");
            colorParaEtiqueta = partes[1];
            textoEtiqueta += (partes[0] === "BASE") ? " • TEMA BASE" : " • SUB-NODO";
        }
        
        const estadoVisual = nodo.estado ? nodo.estado.trim().toLowerCase() : "unlocked";
        const card = document.createElement("article"); card.className = `node-card ${estadoVisual}`; card.style.borderLeftColor = colorParaEtiqueta;
        
        let btnHtml = "";
        if (estadoVisual === "locked") {
            btnHtml = nodo.id === NODO_APERTURA_ID
                ? `<button class="btn btn-locked" disabled style="background: rgba(0,0,0,0.5); color: #f59e0b; border-color: #f59e0b;">Restringido · Reúne 10 audios</button>`
                : `<button class="btn btn-locked btn-abrir-desbloqueo" data-id="${nodo.id}">Ingresar clave secreta</button>`;
        } else {
            btnHtml = `<button class="btn btn-primary btn-abrir-visor" data-id="${nodo.id}">Explorar Material Transmedia</button>`;
        }

        // --- LÓGICA INTEGRADA: RAMIFICACIONES DIRECTAS EN EL NODO PRINCIPAL ---
        let conexionesId = new Set();
        conexionesData.forEach(c => {
            if (c.origen === nodo.id && c.destino.startsWith('N-')) conexionesId.add(c.destino);
            if (c.destino === nodo.id && c.origen.startsWith('N-')) conexionesId.add(c.origen);
        });

        let conHTML = "";
        if (conexionesId.size > 0) {
            conHTML = `<div style="margin-top: 0.8rem; padding-top: 0.8rem; border-top: 1px dashed rgba(255,255,255,0.15);">
                <span style="display:block; font-size:0.75rem; color:var(--text-muted); margin-bottom:0.5rem; text-transform:uppercase; letter-spacing:0.5px;">🔗 Conexiones directas:</span>
                <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">`;
            
            Array.from(conexionesId).forEach(conId => {
                let nodoDest = nodosData.find(n => String(n.id) === String(conId));
                if(nodoDest) {
                    const bloqueado = String(nodoDest.estado || "unlocked").trim().toLowerCase() === "locked";
                    const esApertura = String(nodoDest.id) === NODO_APERTURA_ID;
                    const accion = bloqueado ? (esApertura ? "btn-sin-acceso" : "btn-abrir-desbloqueo") : "btn-abrir-visor";
                    const etiqueta = bloqueado ? `🔒 ${nodoDest.titulo}` : nodoDest.titulo;
                    
                    conHTML += `<button class="btn-ghost ${accion}" data-id="${escaparHTML(conId)}" style="padding: 0.25rem 0.6rem; font-size: 0.72rem; border-radius: 4px; width:auto; border-color: rgba(255,255,255,0.2); color:var(--text-muted); cursor:pointer;">${escaparHTML(etiqueta)}</button>`;
                }
            });
            conHTML += `</div></div>`;
        }

        const estiloEtiqueta = `style="color: ${escaparHTML(colorParaEtiqueta)}; border: 1px solid ${escaparHTML(colorParaEtiqueta)}40; background: rgba(0,0,0,0.4);"`;

        card.innerHTML = `
            <div class="node-header">
                <div style="display:flex; align-items:center; gap: 0.5rem;">
                    <span class="node-type" ${estiloEtiqueta}>${escaparHTML(textoEtiqueta)}</span>
                    <span class="node-id-label" style="background:rgba(0,0,0,0.4);">ID: ${escaparHTML(nodo.id)}</span>
                </div>
                <span>${estadoVisual === "locked" ? '🔒' : '🌐'}</span>
            </div>
            <div class="node-content" style="padding-bottom: 0.5rem;">
                <h3 class="node-title">${escaparHTML(nodo.titulo)}</h3>
                ${nodo.autor ? `<span class="node-autor">Por: ${escaparHTML(nodo.autor)}</span>` : ""}
                <p class="node-excerpt">${escaparHTML(obtenerExtracto(nodo.descripcion))}</p>
                ${conHTML}
            </div>
            ${btnHtml}
        `;
        canvas.appendChild(card);
    });
    
    const contadorNodos = document.getElementById("contador-nodos");
    if (contadorNodos) contadorNodos.innerText = nodosData.length;
}

function obtenerExtracto(descripcion) {
    const texto = String(descripcion || "").trim();
    if (!texto) return "Este nodo todavía no tiene una descripción.";
    return texto.length > 150 ? `${texto.substring(0, 150).trim()}...` : texto;
}

function abrirVisorMultimedia(id) {
    const nodo = nodosData.find(n => String(n.id) === String(id));
    if(!nodo) return;
    if (String(nodo.estado || "unlocked").trim().toLowerCase() === "locked") return;
    
    nodoActivoId = id; 
    document.getElementById("visor-titulo").innerText = nodo.titulo || "Nodo sin título";
    document.getElementById("visor-autor").innerText = nodo.autor ? `Autor: ${nodo.autor}` : "";
    document.getElementById("visor-desc-texto").innerText = nodo.descripcion || "Este nodo todavía no tiene una descripción.";
    
    const mediaContainer = document.getElementById("visor-media"); mediaContainer.innerHTML = ""; mediaContainer.style.display = "block";

    if (nodo.url) {
        let textoBoton = "Abrir Enlace Transmedia"; let icono = "🔗"; let claseColor = "tipo-web";
        if (nodo.tipo === "Video" || nodo.tipo === "Cortometraje") { textoBoton = "Ver Cortometraje / Video"; icono = "🎬"; claseColor = "tipo-video"; }
        else if (nodo.tipo === "Podcast") { textoBoton = "Escuchar Audio / Podcast"; icono = "🎧"; claseColor = "tipo-audio"; }
        else if (nodo.tipo === "Artículo") { textoBoton = "Leer Texto / Artículo Web"; icono = "📄"; claseColor = "tipo-doc"; }
        else if (nodo.tipo === "Imagen" || nodo.tipo === "Infografía") { textoBoton = "Ver Infografía / Imagen"; icono = "🖼️"; claseColor = "tipo-img"; }
        
        let urlCorta = "Enlace externo"; try { urlCorta = new URL(nodo.url).hostname.replace('www.', ''); } catch(e){}
        mediaContainer.innerHTML = `
            <a href="${escaparHTML(obtenerURLSegura(nodo.url))}" target="_blank" rel="noopener noreferrer" data-nodo-id="${escaparHTML(nodo.id)}" class="recurso-link ${claseColor}">
                <div class="recurso-icono">${icono}</div>
                <div class="recurso-info"><span class="recurso-titulo">${textoBoton}</span><span class="recurso-url">${urlCorta}</span></div>
                <div class="recurso-flecha">↗</div>
            </a>
        `;
    } else {
        mediaContainer.style.display = "none";
    }
    
    // Las conexiones también se mantienen en el visor por completitud
    let conexionesId = new Set();
    conexionesData.forEach(c => {
        if (c.origen === id && c.destino.startsWith('N-')) conexionesId.add(c.destino);
        if (c.destino === id && c.origen.startsWith('N-')) conexionesId.add(c.origen);
    });
    
    let topConexiones = Array.from(conexionesId).slice(0, 5);
    let conHTML = "";
    if (topConexiones.length > 0) {
        conHTML = `<h4 style="margin-bottom:0.8rem; color:var(--primary); font-size: 0.95rem;">🔗 Ramificaciones (Nodos Conectados):</h4><div style="display:flex; gap:0.5rem; flex-wrap:wrap;">`;
        topConexiones.forEach(conId => {
            let nodoDest = nodosData.find(n => String(n.id) === String(conId));
            if(nodoDest) {
                const bloqueado = String(nodoDest.estado || "unlocked").trim().toLowerCase() === "locked";
                const esApertura = String(nodoDest.id) === NODO_APERTURA_ID;
                const accion = bloqueado ? (esApertura ? "btn-sin-acceso" : "btn-abrir-desbloqueo") : "btn-abrir-visor";
                const etiqueta = bloqueado ? `🔒 ${nodoDest.titulo}${esApertura ? " · 10 audios" : ""}` : nodoDest.titulo;
                conHTML += `<button class="btn-ghost ${accion}" data-id="${escaparHTML(conId)}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; border-radius: 20px; width:auto; border-color:var(--primary); color:var(--text-main); cursor:pointer;">${escaparHTML(etiqueta)}</button>`;
            }
        });
        conHTML += `</div>`;
    }
    document.getElementById("visor-conexiones").innerHTML = conHTML;
    
    configurarFormularioSegunNodo(id);
    renderizarAportes(id);
    document.getElementById("visor-modal").classList.remove("hidden");
}

function configurarFormularioSegunNodo(idNodo) {
    const cajaComentario = document.getElementById("caja-comentario");
    const selectorTipo = document.getElementById("aporte-tipo");
    const alerta = document.getElementById("alerta-video-aporte");
    if (idNodo === NODO_INICIAL_ID) {
        cajaComentario.style.display = "flex";
        selectorTipo.innerHTML = '<option value="texto">Opinión escrita</option><option value="imagen">Imagen / Infografía</option><option value="audio">Audio / Podcast</option><option value="video">Video / Cortometraje</option><option value="web">Enlace web</option>';
        alerta.innerText = "Este aporte es opcional y sirve para comentar el cortometraje detonante. No afecta las metas de desbloqueo.";
        alerta.style.display = "block";
        limpiarFormularioAporte();
        return;
    }

    cajaComentario.style.display = "flex";
    if (idNodo === NODO_FRECUENCIA_ID) {
        selectorTipo.innerHTML = '<option value="audio">Audio / Podcast (máx. 30 segundos)</option>';
        alerta.innerText = "Esta etapa recibe únicamente evidencias sonoras. Adjunta un enlace público a tu audio y escribe qué revela sobre tu territorio.";
        alerta.style.display = "block";
    } else {
        selectorTipo.innerHTML = '<option value="texto">Texto (Permite enlace opcional)</option><option value="imagen">Imagen / Infografía</option><option value="audio">Audio / Podcast</option><option value="video">Video / Cortometraje</option><option value="web">Enlace web</option>';
        alerta.innerText = "Puedes aportar una reflexión escrita y, opcionalmente, una evidencia multimedia.";
        alerta.style.display = "block";
    }
    limpiarFormularioAporte();
}

function renderizarAportes(idNodo) {
    const muro = document.getElementById("muro-aportes"); muro.innerHTML = "";
    const aportes = aportesData.filter(a => String(a.idNodo) === String(idNodo));
    const contador = document.getElementById("contador-aportes-nodo");
    if (contador) contador.innerText = idNodo === NODO_INICIAL_ID ? `${aportes.length} ${aportes.length === 1 ? "opinión" : "opiniones"}` : `${aportes.length} ${aportes.length === 1 ? "reflexión" : "reflexiones"}`;
    if (aportes.length === 0) { muro.innerHTML = `<p style="color:var(--text-muted);">Sin reflexiones aún. Ayuda a expandir el rizoma aportando tu visión aquí abajo.</p>`; return; }

    aportes.forEach(aporte => {
        let mediaHtml = "";
        
        if (aporte.url) {
            let labelAporte = "Abrir Enlace Adjunto";
            let iconoAporte = "🔗";
            let claseAporte = "tipo-web";
            
            if (aporte.tipo === "video") {
                labelAporte = "Reproducir Video Adjunto"; iconoAporte = "▶️"; claseAporte = "tipo-video";
            } else if (aporte.tipo === "audio") {
                labelAporte = "Escuchar Audio Adjunto"; iconoAporte = "🎧"; claseAporte = "tipo-audio";
            } else if (aporte.tipo === "imagen") {
                labelAporte = "Ver Imagen Adjunta"; iconoAporte = "🖼️"; claseAporte = "tipo-img";
            }

            let urlCorta = "Archivo adjunto"; try { urlCorta = new URL(aporte.url).hostname.replace('www.', ''); } catch(e){}
            mediaHtml = `
                <a href="${escaparHTML(obtenerURLSegura(aporte.url))}" target="_blank" rel="noopener noreferrer" class="recurso-link ${claseAporte}" style="margin-top: 1rem; padding: 0.6rem 1rem; background: rgba(0,0,0,0.2);">
                    <div class="recurso-icono" style="width: 35px; height: 35px; font-size: 1rem;">${iconoAporte}</div>
                    <div class="recurso-info"><span class="recurso-titulo" style="font-size: 0.85rem;">${labelAporte}</span><span class="recurso-url" style="font-size: 0.7rem;">${urlCorta}</span></div>
                    <div class="recurso-flecha" style="font-size: 1rem;">↗</div>
                </a>
            `;
        }

        muro.innerHTML += `
            <div class="aporte-card">
                <div class="aporte-meta">
                    <span style="display:flex; align-items:center; gap:0.5rem;">👤 ${aporte.autor || 'Anónimo'} • 📍 ${aporte.ubicacion || 'Territorio Digital'}</span>
                    <span>${aporte.fecha}</span>
                </div>
                <div class="aporte-txt">${escaparHTML(aporte.texto)}</div>
                ${mediaHtml}
            </div>
        `;
    });
}

function configurarEventos() {
    document.addEventListener("click", (e) => {
        const recursoInicial = e.target.closest(".recurso-link[data-nodo-id]");
        if (recursoInicial && recursoInicial.dataset.nodoId === NODO_INICIAL_ID) {
            localStorage.setItem(MEMORIA_VIDEO, "true");
            renderizarNodos();
        }
        
        // Al dar clic en el botón de un nodo principal O en el botón de una ramificación:
        const btnVisor = e.target.closest(".btn-abrir-visor");
        if (btnVisor) {
            const id = btnVisor.getAttribute("data-id");
            abrirVisorMultimedia(id);
        }
        
        const btnUnlock = e.target.closest(".btn-abrir-desbloqueo");
        if (btnUnlock) {
            nodoActivoId = btnUnlock.getAttribute("data-id"); 
            document.getElementById("decoder-modal").classList.remove("hidden"); 
            document.getElementById("transmedia-key").value = "";
            document.getElementById("modal-error").classList.add("hidden");
        }
    });

    document.getElementById("btn-unlock").addEventListener("click", async () => {
        const clave = document.getElementById("transmedia-key").value.trim().toUpperCase();
        const nodo = nodosData.find(n => String(n.id) === String(nodoActivoId));
        
        if (nodo && (nodo.clave || "").trim().toUpperCase() === clave) {
            const btnDesbloquear = document.getElementById("btn-unlock");
            btnDesbloquear.disabled = true;
            btnDesbloquear.innerText = "Verificando...";
            const guardado = await enviarADrive("DESBLOQUEAR_NODO", { id: nodoActivoId, clave: clave });
            if (!guardado && GOOGLE_SCRIPT_URL !== "") {
                btnDesbloquear.disabled = false;
                btnDesbloquear.innerText = "Desencriptar Nodo";
                document.getElementById("modal-error").innerText = "No fue posible guardar el desbloqueo. Intenta nuevamente.";
                document.getElementById("modal-error").classList.remove("hidden");
                return;
            }
            nodo.estado = "unlocked";
            btnDesbloquear.disabled = false;
            btnDesbloquear.innerText = "Desencriptar Nodo";
            document.getElementById("decoder-modal").classList.add("hidden");
            
            let nodosLiberadosLocal = [];
            try { nodosLiberadosLocal = JSON.parse(localStorage.getItem("nodosDesbloqueados")) || []; } catch (error) { localStorage.removeItem("nodosDesbloqueados"); }
            if (!nodosLiberadosLocal.includes(nodoActivoId)) {
                nodosLiberadosLocal.push(nodoActivoId);
                localStorage.setItem("nodosDesbloqueados", JSON.stringify(nodosLiberadosLocal));
            }
            
            renderizarNodos(); 
            abrirVisorMultimedia(nodoActivoId);
        } else {
            document.getElementById("modal-error").classList.remove("hidden");
        }
    });

    document.getElementById("btn-fab-crear").addEventListener("click", () => {
        const audiosFrecuencia = contarAudiosDeFrecuencia();
        if (!rizomaDesbloqueado()) {
            const avance = tercerNodoDesbloqueado() ? contarVideosDelRizoma() : audiosFrecuencia;
            const meta = tercerNodoDesbloqueado() ? META_VIDEOS : META_AUDIOS;
            const faltan = meta - avance;
            
            document.getElementById("restriccion-contador").innerText = avance;
            document.getElementById("restriccion-meta").innerText = meta;
            
            const modalTitle = document.querySelector("#restriccion-modal h2");
            const modalDesc = document.querySelector("#restriccion-modal p");
            
            if (tercerNodoDesbloqueado()) {
                modalTitle.innerText = "⏳ EL RIZOMA ESTÁ POR LIBERARSE";
                modalTitle.style.color = "#f59e0b";
                modalDesc.innerText = `El rizoma está por liberarse. Faltan ${faltan} videos en Pedagogía crítica virtual para romper la estructura lineal definitivamente.`;
            } else {
                modalTitle.innerText = "⚠️ SISTEMA RESTRINGIDO";
                modalTitle.style.color = "var(--danger)";
                modalDesc.innerText = `La red necesita ${META_AUDIOS} audios en Frecuencia Emancipada para abrir el tercer nodo.`;
            }
            
            document.getElementById("restriccion-modal").classList.remove("hidden");
            return;
        }
        
        document.getElementById("crear-nodo-modal").classList.remove("hidden");
        actualizarSelectorPadres();
        document.getElementById("nuevo-nivel").value = "BASE";
        document.getElementById("nuevo-nivel").dispatchEvent(new Event('change'));
    });
    
    document.getElementById("nuevo-nivel").addEventListener("change", (e) => {
        if (e.target.value === "BASE") {
            document.getElementById("caja-base").style.display = "flex";
            document.getElementById("caja-sub").style.display = "none";
        } else {
            document.getElementById("caja-base").style.display = "none";
            document.getElementById("caja-sub").style.display = "block";
            actualizarSelectorPadres();
        }
    });

    document.getElementById("btn-save-nodo").addEventListener("click", async () => {
        const titulo = document.getElementById("nuevo-titulo").value.trim();
        if (!titulo) { alert("SISTEMA: El 'Título' es obligatorio para poder fundar un nuevo nodo."); return; }
        
        const tipoNodo = document.getElementById("nuevo-tipo").value;
        const urlNodo = document.getElementById("nuevo-url").value.trim();
        
        if (!urlNodo) { alert(`SISTEMA: Para un nodo transmedia tipo '${tipoNodo}', el Enlace Externo del material es completamente OBLIGATORIO.`); return; }

        const btnGuardar = document.getElementById("btn-save-nodo"); btnGuardar.innerText = "Conectando..."; btnGuardar.disabled = true;

        let temaFinal = "";
        const nivel = document.getElementById("nuevo-nivel").value;
        
        if (nivel === "BASE") {
            const color = document.getElementById("color-base").value;
            const nombre = document.getElementById("nombre-tema-base").value.trim() || titulo;
            temaFinal = `BASE|||${color}|||${nombre}`;
        } else {
            const valPadre = document.getElementById("tema-padre").value;
            if (valPadre) {
                const partes = valPadre.split("|||");
                temaFinal = `SUB|||${partes[0]}|||${partes[1]}`;
            } else {
                temaFinal = `SUB|||#a1a1aa|||Neutro`;
            }
        }

        const nuevoNodo = {
            id: "N-" + Date.now(), titulo: titulo, autor: document.getElementById("nuevo-autor").value.trim() || "Anónimo",
            descripcion: document.getElementById("nuevo-desc").value.trim(), tipo: tipoNodo,
            tema: temaFinal, url: urlNodo, clave: "", estado: "unlocked"
        };
        
        nodosData.push(nuevoNodo); renderizarNodos(); document.getElementById("crear-nodo-modal").classList.add("hidden");
        await enviarADrive("CREAR_NODO", nuevoNodo);
        btnGuardar.innerText = "Crear Nodo Libre"; btnGuardar.disabled = false; limpiarFormularioNodo();
    });

    document.getElementById("aporte-tipo").addEventListener("change", (e) => {
        const urlInput = document.getElementById("aporte-url");
        const alertaAporte = document.getElementById("alerta-video-aporte");
        if (e.target.value === "texto") {
            urlInput.placeholder = "Enlace web de referencia (Opcional)";
            alertaAporte.innerText = "";
            alertaAporte.style.display = "none";
        } else if (e.target.value === "audio") {
            urlInput.placeholder = "Enlace al podcast o audio (Obligatorio)";
            alertaAporte.innerText = nodoActivoId === NODO_INICIAL_ID
                ? "Puedes adjuntar un audio como opinión sobre el cortometraje. Este aporte es opcional y no afecta ninguna meta."
                : "Misión sonora: el audio debe durar máximo 30 segundos. Sube el archivo a tu servicio preferido y pega aquí su enlace público.";
            alertaAporte.style.display = "block";
        } else {
            urlInput.placeholder = `Pega el enlace de tu ${e.target.value} aquí (* Obligatorio)`;
            alertaAporte.innerText = "El enlace multimedia será visible para quienes consulten este aporte.";
            alertaAporte.style.display = "block";
        }
    });

    const aporteTexto = document.getElementById("aporte-texto");
    const contadorCaracteres = document.getElementById("contador-caracteres-aporte");
    if(aporteTexto) {
        aporteTexto.maxLength = 1000;
        aporteTexto.addEventListener("input", () => {
            contadorCaracteres.innerText = `${aporteTexto.value.length} / 1000`;
        });
    }

    document.getElementById("btn-enviar-aporte").addEventListener("click", async () => {
        const texto = document.getElementById("aporte-texto").value.trim(); 
       if (!texto) {
            document.getElementById("reflexion-vacia-modal").classList.remove("hidden");
            return;
        }
        
        const tipoAporte = document.getElementById("aporte-tipo").value;
        const urlAporte = document.getElementById("aporte-url").value.trim();

        if (nodoActivoId === NODO_FRECUENCIA_ID && tipoAporte !== "audio") {
            alert("Esta frecuencia recibe únicamente audios de máximo 30 segundos."); return;
        }
        
        if ((tipoAporte === "audio" || tipoAporte === "video" || tipoAporte === "imagen") && !urlAporte) {
            alert(`SISTEMA: Has elegido incrustar '${tipoAporte}'. El enlace del archivo multimedia es obligatorio.`); return;
        }
        if (urlAporte && obtenerURLSegura(urlAporte) === "#") {
            alert("SISTEMA: Introduce un enlace web válido que comience por http:// o https://."); return;
        }

        const btnAporte = document.getElementById("btn-enviar-aporte"); btnAporte.innerText = "Transmitiendo..."; btnAporte.disabled = true;
        const fechaActual = new Date().toLocaleDateString('es-CO');
        
        const nuevoAporte = {
            idAporte: "A-" + Date.now(), idNodo: nodoActivoId,
            tipo: tipoAporte, autor: document.getElementById("aporte-autor").value.trim() || "Anónimo", 
            ubicacion: document.getElementById("aporte-ubicacion").value.trim() || "Territorio local", texto: texto, url: urlAporte, fecha: fechaActual
        };

        aportesData.push(nuevoAporte); 
        renderizarAportes(nodoActivoId);
        renderizarNodos(); 
        
        const exito = await enviarADrive("NUEVO_APORTE", nuevoAporte);
        if (!exito && GOOGLE_SCRIPT_URL !== "") { console.warn("Fallo el guardado en Drive, pero se mantiene en sesión local."); }
        
        btnAporte.innerText = "Transmitir Reflexión"; btnAporte.disabled = false; limpiarFormularioAporte();
    });

    document.querySelectorAll(".btn-cerrar-modal").forEach(btn => {
        btn.addEventListener("click", (e) => { e.target.closest(".modal").classList.add("hidden"); });
    });

    const btnIniciar = document.getElementById("btn-iniciar-experiencia");
    if (btnIniciar) {
        btnIniciar.addEventListener("click", () => {
            localStorage.setItem(MEMORIA_INICIO, "true");
            document.getElementById("onboarding-modal").classList.add("hidden");
            renderizarNodos();
        });
    }

    const btnIrARed = document.getElementById("btn-ir-a-red");
    if (btnIrARed) {
        btnIrARed.addEventListener("click", () => {
            document.getElementById("mision-modal")?.classList.add("hidden");
            const canvas = document.getElementById("rhizome-canvas");
            if (canvas) canvas.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }
}

function limpiarFormularioNodo() {
    document.getElementById("nuevo-titulo").value = ""; document.getElementById("nuevo-autor").value = "";
    document.getElementById("nuevo-url").value = ""; document.getElementById("nuevo-desc").value = ""; document.getElementById("nuevo-tipo").value = "Artículo"; 
    
    const totalAportes = aportesData.length;
    document.getElementById("nuevo-nivel").value = totalAportes >= 15 ? "BASE" : "SUB";
    document.getElementById("nuevo-nivel").dispatchEvent(new Event('change'));
}

function limpiarFormularioAporte() {
    document.getElementById("aporte-texto").value = ""; document.getElementById("aporte-url").value = ""; 
    const selectorTipo = document.getElementById("aporte-tipo");
    selectorTipo.value = selectorTipo.querySelector("option[value='texto']") ? "texto" : selectorTipo.options[0]?.value || "";
    document.getElementById("aporte-autor").value = ""; document.getElementById("aporte-ubicacion").value = "";
    document.getElementById("aporte-url").placeholder = selectorTipo.value === "audio" ? "Enlace al podcast o audio (Obligatorio)" : "Enlace web de referencia (Opcional)";
}