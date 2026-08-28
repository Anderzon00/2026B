const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyiNuNnVgV4wwmD6WSKmS15d3p-TFTX2zHd-IWJigJglstvNGNG_aTDIPAtHXB49oQ/exec"; 

let nodosData = [];
let aportesData = [];
let conexionesData = [];
let nodoActivoId = null;
const NODO_INICIAL_ID = "N-001";
const NODO_FRECUENCIA_ID = "N-002";
const NODO_APERTURA_ID = "N-003";
const META_AUDIOS = 2;
const META_ELEMENTOS = 3;
const MEMORIA_INICIO = "archivoExperienciaIniciada";
const MEMORIA_VIDEO = "archivoVideoInicialVisto";

const COMENTARIO_TARJETA_1 = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; padding: 15px;">
    <p>Paso 1: Acceder al enlace "Abrir Enlace Transmedia" ubicado en la parte de arriba.</p> <br>

    <p><span style="color: #d9534f; font-weight: bold;">Busca en esa página el único número de distinto color.</span></p>
 
    <p><span style="color: #d9534f; font-weight: bold;">Suma 36 al número encontrado.</span></p> <br>
 
    <p><span style="color: #d9534f; font-weight: bold;">Restar los dígitos: Toma el resultado de tu suma y resta el segundo dígito del primero. Por ejemplo, si la suma te dio 85, la operación matemática que debes hacer es 8 - 5 = 3. 
  vuelve al enlace  y busca la tarjeta que corresponda al resultado, el texto resaltado es la clave para ingresar a la siguiente tarjeta "Voces del territorio" .</span></p>

 
</div>`;

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>'"]/g, caracter => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[caracter]));
}

function obtenerURLSegura(valor) {
    try {
        const url = new URL(valor);
        return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
    } catch (error) { return "#"; }
}

function iconoTipoAporte(tipo) { return { texto: "💬", imagen: "🖼️", audio: "🎧", video: "▶️", web: "🔗" }[tipo] || "📌"; }
function etiquetaTipoAporte(tipo) { return { texto: "Reflexión", imagen: "Imagen", audio: "Audio", video: "Video", web: "Enlace" }[tipo] || "Aporte"; }
function claseColorAporte(tipo) { return { video: "tipo-video", audio: "tipo-audio", imagen: "tipo-img", web: "tipo-web", texto: "tipo-texto" }[tipo] || "tipo-texto"; }
function claseChipTipo(tipo) { return { video: "chip-video", audio: "chip-audio", imagen: "chip-img", web: "chip-web", texto: "chip-texto" }[tipo] || "chip-texto"; }

function obtenerYoutubeId(url) {
    const patrones = [/youtu\.be\/([a-zA-Z0-9_-]{6,})/, /[?&]v=([a-zA-Z0-9_-]{6,})/, /embed\/([a-zA-Z0-9_-]{6,})/];
    for (const patron of patrones) { const match = String(url).match(patron); if (match) return match[1]; }
    return null;
}
function obtenerVimeoId(url) {
    const match = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return match ? match[1] : null;
}

function generarMediaAporte(aporte) {
    if (!aporte.url) return "";
    const urlOriginal = String(aporte.url);
    const urlSegura = escaparHTML(obtenerURLSegura(urlOriginal));
    const tipo = String(aporte.tipo || "").toLowerCase();

    if (tipo === "imagen" && /\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i.test(urlOriginal)) {
        return `<div class="aporte-media aporte-media-img"><img src="${urlSegura}" alt="Imagen aportada por ${escaparHTML(aporte.autor || 'la comunidad')}" loading="lazy"></div>`;
    }
    if (tipo === "audio" && /\.(mp3|wav|ogg|m4a|webm)(\?.*)?$/i.test(urlOriginal)) {
        return `<div class="aporte-media aporte-media-audio"><audio controls preload="none" src="${urlSegura}"></audio></div>`;
    }
    if (tipo === "video") {
        const idYoutube = obtenerYoutubeId(urlOriginal);
        const idVimeo = !idYoutube ? obtenerVimeoId(urlOriginal) : null;
        if (idYoutube) return `<div class="aporte-media aporte-media-video"><iframe src="https://www.youtube.com/embed/${idYoutube}" title="Video aportado por la comunidad" loading="lazy" allowfullscreen></iframe></div>`;
        if (idVimeo) return `<div class="aporte-media aporte-media-video"><iframe src="https://player.vimeo.com/video/${idVimeo}" title="Video aportado por la comunidad" loading="lazy" allowfullscreen></iframe></div>`;
    }

    let labelAporte = "Abrir Enlace Adjunto"; let iconoAporte = "🔗"; let claseAporte = "tipo-web";
    if (tipo === "video") { labelAporte = "Reproducir Video Adjunto"; iconoAporte = "▶️"; claseAporte = "tipo-video"; }
    else if (tipo === "audio") { labelAporte = "Escuchar Audio Adjunto"; iconoAporte = "🎧"; claseAporte = "tipo-audio"; }
    else if (tipo === "imagen") { labelAporte = "Ver Imagen Adjunta"; iconoAporte = "🖼️"; claseAporte = "tipo-img"; }

    let urlCorta = "Archivo adjunto"; try { urlCorta = new URL(urlOriginal).hostname.replace('www.', ''); } catch (e) {}
    return `
        <a href="${urlSegura}" target="_blank" rel="noopener noreferrer" class="recurso-link ${claseAporte}" style="margin-top: 0.9rem; padding: 0.6rem 1rem; background: rgba(0,0,0,0.2);">
            <div class="recurso-icono" style="width: 35px; height: 35px; font-size: 1rem;">${iconoAporte}</div>
            <div class="recurso-info"><span class="recurso-titulo" style="font-size: 0.85rem;">${labelAporte}</span><span class="recurso-url" style="font-size: 0.7rem;">${urlCorta}</span></div>
            <div class="recurso-flecha" style="font-size: 1rem;">↗</div>
        </a>
    `;
}

function contarAudiosDeFrecuencia() {
    return parseInt(localStorage.getItem("misAudiosFrecuencia") || "0", 10);
}

function contarElementosDelRizoma() {
    return parseInt(localStorage.getItem("misElementosRizoma") || "0", 10);
}

function rizomaDesbloqueado() {
    return contarElementosDelRizoma() >= META_ELEMENTOS;
}

function tercerNodoDesbloqueado() {
    const nodoApertura = nodosData.find(nodo => String(nodo.id) === NODO_APERTURA_ID);
    return nodoApertura && String(nodoApertura.estado).toLowerCase() === "unlocked";
}

function puedeVerMapa() {
    return videoInicialVisto() && contarAudiosDeFrecuencia() >= META_AUDIOS;
}

function experienciaIniciada() { return localStorage.getItem(MEMORIA_INICIO) === "true"; }
function videoInicialVisto() { return localStorage.getItem(MEMORIA_VIDEO) === "true"; }

function obtenerNodosVisibles() {
    if (!experienciaIniciada() || !videoInicialVisto()) return nodosData.filter(nodo => String(nodo.id) === NODO_INICIAL_ID);
    if (contarAudiosDeFrecuencia() < META_AUDIOS) return nodosData.filter(nodo => [NODO_INICIAL_ID, NODO_FRECUENCIA_ID].includes(String(nodo.id)));
    if (contarElementosDelRizoma() < META_ELEMENTOS) return nodosData.filter(nodo => [NODO_INICIAL_ID, NODO_FRECUENCIA_ID, NODO_APERTURA_ID].includes(String(nodo.id)));
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
        
        const nodoInicial = nodosData.find(nodo => String(nodo.id) === NODO_INICIAL_ID);
        if (nodoInicial) nodoInicial.descripcion = COMENTARIO_TARJETA_1;
        
        aplicarProgresoLocal();
        renderizarNodos();
    } catch (error) {
        console.error("Fallo la conexión con Drive:", error);
    }
}



function aplicarProgresoLocal() {
    const nodoFrecuencia = nodosData.find(nodo => String(nodo.id) === NODO_FRECUENCIA_ID);
    if (nodoFrecuencia) nodoFrecuencia.estado = "locked"; 

    const nodoApertura = nodosData.find(nodo => String(nodo.id) === NODO_APERTURA_ID);
    if (nodoApertura) nodoApertura.estado = "locked"; 

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
        if (nodoApertura) nodoApertura.estado = "unlocked";
    }
}

async function enviarADrive(accion, payload) {
    if (GOOGLE_SCRIPT_URL === "") return true; 
    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", body: JSON.stringify({ accion: accion, datos: payload }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        if (!res.ok) return false;
        return (await res.json()).status === "success";
    } catch (e) { console.error("Error de transmisión:", e); return false; }
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
    const faseRed = document.getElementById("fase-red");

    const audiosFrecuencia = contarAudiosDeFrecuencia();
    if (audiosFrecuencia >= META_AUDIOS) {
        const nodoApertura = nodosData.find(nodo => String(nodo.id) === NODO_APERTURA_ID);
        if (nodoApertura) nodoApertura.estado = "unlocked";
    }
    const elementosRizoma = contarElementosDelRizoma();
    const expansionDesbloqueada = rizomaDesbloqueado();

    if (labelAportes) labelAportes.innerText = `${audiosFrecuencia}/${META_AUDIOS}`;
    const contadorVideos = document.getElementById("contador-videos");
    if (contadorVideos) contadorVideos.innerText = `${elementosRizoma}/${META_ELEMENTOS}`;

    const nodoFrecuencia = nodosData.find(nodo => String(nodo.id) === NODO_FRECUENCIA_ID);
    const frecuenciaDesbloqueada = nodoFrecuencia && String(nodoFrecuencia.estado).toLowerCase() === "unlocked";

    const heroTitulo = document.getElementById("hero-titulo");
    const heroDesc = document.getElementById("hero-desc");

    if (subHeader) subHeader.style.display = "block";
    
    if (!frecuenciaDesbloqueada) {
        if (subHeader) { subHeader.innerText = "RED BLOQUEADA · FASE INICIAL"; subHeader.style.color = "var(--danger)"; }
        if (btnFab) btnFab.style.display = "none";
        if (labelAportes) labelAportes.style.color = "var(--text-muted)";
        if (faseRed) { faseRed.innerText = "Fase 01 · Mira el video y descifra la primera clave para acceder al sistema."; faseRed.style.color = "var(--amber)"; }
        if (heroTitulo) heroTitulo.innerText = "La historia no está completa.";
        if (heroDesc) heroDesc.innerHTML = "<strong>El currículo oficial tiene vacíos y nos han entregado una versión procesada de la realidad.</strong> Este rizoma es una cartografía transmedia viva donde la comunidad reconstruye el conocimiento que el archivo dejó fuera. Cada aporte sonoro, audiovisual o escrito que sumas al territorio crea nuevas conexiones de pensamiento. Explora los nodos, descubre las claves ocultas y ayúdanos a romper la estructura lineal del sistema pedagógico.";
    } else if (audiosFrecuencia < META_AUDIOS) {
        if (subHeader) { subHeader.innerText = `RED PARCIALMENTE ABIERTA · FALTAN ${META_AUDIOS - audiosFrecuencia} AUDIOS`; subHeader.style.color = "#f59e0b"; }
        if (btnFab) btnFab.style.display = "none";
        if (labelAportes) labelAportes.style.color = "#f59e0b"; 
        if (faseRed) { faseRed.innerText = `Fase 02 · Sube ${META_AUDIOS - audiosFrecuencia} audio(s) a Frecuencia Emancipada para desbloquear el siguiente nodo.`; faseRed.style.color = "#f59e0b"; }
        if (heroTitulo) heroTitulo.innerText = "La historia está creciendo.";
        if (heroDesc) heroDesc.innerHTML = "<strong>El sistema se ha abierto parcialmente.</strong> La comunidad ya descifró la primera clave, pero el rizoma necesita evidencias sonoras para expandirse. Sube un audio de máximo 30 segundos a Frecuencia Emancipada y acompaña tu grabación con una reflexión escrita sobre lo que descubriste en tu territorio.";
    } else if (elementosRizoma < META_ELEMENTOS) {
        if (subHeader) { subHeader.innerText = `RED CASI LIBRE · FALTAN ${META_ELEMENTOS - elementosRizoma} ELEMENTOS`; subHeader.style.color = "#f59e0b"; }
        if (btnFab) btnFab.style.display = "none";
        if (labelAportes) labelAportes.style.color = "var(--teal)";
        if (faseRed) { faseRed.innerText = `Fase 03 · Aporta ${META_ELEMENTOS - elementosRizoma} elemento(s) más (texto o video) para liberar el rizoma.`; faseRed.style.color = "#f59e0b"; }
        if (heroTitulo) heroTitulo.innerText = "La historia casi está completa.";
        if (heroDesc) heroDesc.innerHTML = "<strong>Los audios ya están en la red, pero el rizoma todavía tiene zonas restringidas.</strong> Pedagogía crítica virtual necesita 3 elementos (texto o video) de la comunidad para romper definitivamente la estructura lineal del sistema. Cada aporte acerca el momento en que la creación de nuevos nodos se libera para todos.";
    } else {
        if (subHeader) { subHeader.innerText = "RED LIBERADA · COMUNIDAD EN ACCIÓN"; subHeader.style.color = "var(--teal)"; }
        if (btnFab) btnFab.style.display = "block";
        if (labelAportes) labelAportes.style.color = "var(--teal)";
        if (faseRed) { faseRed.innerText = "Fase 04 · El rizoma está libre. Crea nuevos nodos, traza conexiones y expande el conocimiento colectivo."; faseRed.style.color = "var(--teal)"; }
        if (heroTitulo) heroTitulo.innerText = "La historia está completa.";
        if (heroDesc) heroDesc.innerHTML = "<strong>La comunidad ha roto todas las restricciones del sistema.</strong> El rizoma es una cartografía transmedia viva y completamente libre. Cada nodo, cada aporte y cada conexión que creas expande el conocimiento colectivo más allá de lo que el archivo original intentó controlar. Ahora la historia la escribes tú.";
        if (selectNivel && selectNivel.querySelector("option[value='BASE']")) selectNivel.querySelector("option[value='BASE']").disabled = false;
        if (alertaTema) alertaTema.style.display = "none";
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

    const nodosMostrados = [...obtenerNodosVisibles()].sort((a, b) => {
        const numA = parseInt(String(a.id).replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(String(b.id).replace(/\D/g, ""), 10) || 0;
        return numA - numB;
    });
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
        card.id = `tarjeta-${nodo.id}`; 
        
        let btnHtml = "";
        if (estadoVisual === "locked") {
            btnHtml = nodo.id === NODO_APERTURA_ID
                ? `<button class="btn btn-locked" disabled style="background: rgba(0,0,0,0.5); color: #f59e0b; border-color: #f59e0b; margin-top: auto;">🔒 Requiere ${META_AUDIOS} audio(s) para desbloquear</button>`
                : `<button class="btn btn-locked btn-abrir-desbloqueo" data-id="${nodo.id}" style="margin-top: auto;">🔐 Ingresar clave de acceso</button>`;
        } else {
            btnHtml = `<button class="btn btn-primary btn-abrir-visor" data-id="${nodo.id}" style="margin-top: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">Ver tarjeta del nodo</button>`;
        }

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
                    const accion = bloqueado ? "btn-bloqueado" : "btn-abrir-visor";
                    const etiqueta = bloqueado ? `🔒 ${nodoDest.titulo}` : nodoDest.titulo;
                    const tip = bloqueado ? `title="Nodo bloqueado"` : "";
                    
                    conHTML += `<button class="btn-ghost ${accion}" data-id="${escaparHTML(conId)}" ${tip} style="padding: 0.5rem 0.75rem; font-size: 0.82rem; border-radius: 4px; width:auto; min-height: 2.6rem; border-color: rgba(255,255,255,0.2); color:var(--text-muted); cursor:pointer;">${escaparHTML(etiqueta)}</button>`;
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
                <div class="node-card-action">${btnHtml}</div>
            </div>
        `;
        canvas.appendChild(card);
    });
    
    const contadorNodos = document.getElementById("contador-nodos");
    if (contadorNodos) contadorNodos.innerText = nodosData.length;
}

function obtenerExtracto(descripcion) {
    const div = document.createElement("div");
    div.innerHTML = String(descripcion || "");
    const texto = (div.textContent || "").trim();
    if (!texto) return "Este nodo todavía no tiene una descripción.";
    return texto.length > 150 ? `${texto.substring(0, 150).trim()}...` : texto;
}

function mostrarProhibido() {
    let toast = document.getElementById("prohibido-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "prohibido-toast";
        toast.className = "prohibido-toast";
        toast.setAttribute("role", "status");
        toast.innerHTML = '<span class="prohibido-ico">🚫</span><span class="prohibido-txt">Nodo bloqueado</span>';
        document.body.appendChild(toast);
    }
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove("show"), 1400);
}

function abrirVisorMultimedia(id) {
    const nodo = nodosData.find(n => String(n.id) === String(id));
    if(!nodo) return;
    if (String(nodo.estado || "unlocked").trim().toLowerCase() === "locked") return;
    
    nodoActivoId = id; 
    document.getElementById("visor-titulo").innerText = nodo.titulo || "Nodo sin título";
    document.getElementById("visor-autor").innerHTML = nodo.autor ? `<span style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.05); padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);"><span style="color:var(--teal);">👤</span> ${escaparHTML(nodo.autor)}</span>` : "";
    document.getElementById("visor-desc-texto").innerHTML = nodo.descripcion ? (String(nodo.id) === NODO_INICIAL_ID ? nodo.descripcion : escaparHTML(nodo.descripcion).replace(/\n/g, '<br>')) : "<i>Este nodo todavía no tiene una descripción.</i>";
    
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
    } else { mediaContainer.style.display = "none"; }
    
    let conexionesId = new Set();
    conexionesData.forEach(c => {
        if (c.origen === id && c.destino.startsWith('N-')) conexionesId.add(c.destino);
        if (c.destino === id && c.origen.startsWith('N-')) conexionesId.add(c.origen);
    });
    
    let topConexiones = Array.from(conexionesId).slice(0, 5);
    let conHTML = "";
    if (topConexiones.length > 0) {
        conHTML = `<h4 class="visor-section-title">🔗 Ramificaciones (Nodos Conectados)</h4><div style="display:flex; flex-wrap:wrap; gap:0.5rem;">`;
        topConexiones.forEach(conId => {
            let nodoDest = nodosData.find(n => String(n.id) === String(conId));
            if(nodoDest) {
                const bloqueado = String(nodoDest.estado || "unlocked").trim().toLowerCase() === "locked";
                const esApertura = String(nodoDest.id) === NODO_APERTURA_ID;
                const accion = bloqueado ? "btn-bloqueado" : "btn-abrir-visor";
                const etiqueta = bloqueado ? `🔒 ${nodoDest.titulo}${esApertura ? " · " + META_AUDIOS + " audios" : ""}` : nodoDest.titulo;
                const tip = bloqueado ? `title="Nodo bloqueado"` : "";
                conHTML += `<button class="btn-ghost ${accion}" data-id="${escaparHTML(conId)}" ${tip} style="padding: 0.6rem 0.95rem; font-size: 0.85rem; min-height: 2.8rem; border-radius: 6px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.15); color: var(--text-main); cursor: pointer; text-align: left; transition: all 0.2s;">${escaparHTML(etiqueta)}</button>`;
            }
        });
        conHTML += `</div>`;
    }
    document.getElementById("visor-conexiones").innerHTML = conHTML;
    
    configurarFormularioSegunNodo(id);
    renderizarAportes(id);
    
    const btnAporte = document.getElementById("btn-enviar-aporte");
    if (btnAporte) { btnAporte.innerText = "Publicar en la red"; btnAporte.disabled = false; }
    ocultarErrorAporte();
    
    document.getElementById("visor-modal").classList.remove("gone");
}

function configurarFormularioSegunNodo(idNodo) {
    const cajaComentario = document.getElementById("caja-comentario");
    const selectorTipo = document.getElementById("aporte-tipo");
    const alerta = document.getElementById("alerta-video-aporte");
    
    if (idNodo === NODO_INICIAL_ID) {
        cajaComentario.classList.add("hidden-important");
        return;
    }

    cajaComentario.classList.remove("hidden-important");
    if (idNodo === NODO_FRECUENCIA_ID) {
        selectorTipo.innerHTML = '<option value="audio">Audio (máx. 30 segundos)</option>';
        alerta.innerText = "Frecuencia Emancipada solo recibe evidencias sonoras. Graba unaproblemática educativa de tu territorio (máx. 30 seg) y escribe qué revela.";
        alerta.style.display = "block";
    } else if (idNodo === NODO_APERTURA_ID) {
        const elementosSubidos = contarElementosDelRizoma();
        selectorTipo.innerHTML = '<option value="texto">Solo Texto</option><option value="video">Solo Video</option>';
        if (elementosSubidos >= META_ELEMENTOS) {
            alerta.innerText = "¡Meta alcanzada! Pedagogía crítica virtual sigue recibiendo texto o video para fortalecer el rizoma.";
        } else {
            alerta.innerText = `Faltan ${META_ELEMENTOS - elementosSubidos} elemento(s) (texto o video) para liberar el rizoma y habilitar la creación de nuevos nodos.`;
        }
        alerta.style.display = "block";
    } else {
        selectorTipo.innerHTML = '<option value="texto">Solo Texto</option><option value="imagen">Texto + Imagen</option><option value="audio">Texto + Audio</option><option value="video">Texto + Video</option><option value="web">Texto + Enlace</option>';
        alerta.innerText = "Aporta una reflexión escrita y, opcionalmente, una evidencia multimedia (imagen, audio, video o enlace).";
        alerta.style.display = "block";
    }
    limpiarFormularioAporte();
}

function actualizarCampoUrlSegunTipo() {
    const tipo = document.getElementById("aporte-tipo")?.value;
    const urlInput = document.getElementById("aporte-url");
    const labelUrl = document.getElementById("label-aporte-url");
    const alertaAporte = document.getElementById("alerta-video-aporte");
    const contenedorEnlace = document.getElementById("contenedor-enlace");
    if (!tipo || !urlInput || !labelUrl || !alertaAporte) return;

    let icon = "🔗";
    if(tipo === "imagen") icon = "🖼️";
    if(tipo === "audio") icon = "🎧";
    if(tipo === "video") icon = "🎬";

    if (tipo === "texto") {
        urlInput.placeholder = "Pega un link aquí si deseas añadir referencia...";
        labelUrl.innerHTML = `${icon} <span>Enlace de apoyo (Opcional)</span>`;
        labelUrl.className = "campo-label opcional";
        alertaAporte.innerText = "";
        alertaAporte.style.display = "none";
        if(contenedorEnlace) contenedorEnlace.classList.remove("obligatorio");
    } else {
        let reqText = "Obligatorio";
        if(tipo === "audio") {
            urlInput.placeholder = "https://...";
            reqText = "Enlace a tu audio (* Obligatorio)";
            alertaAporte.innerText = "Sube el archivo a tu servicio preferido y pega aquí su enlace público.";
        } else if (tipo === "web") {
            urlInput.placeholder = "https://...";
            reqText = "Enlace del recurso web (* Obligatorio)";
            alertaAporte.innerText = "El enlace será visible para quienes consulten este aporte.";
        } else {
            urlInput.placeholder = "https://...";
            reqText = `Enlace a tu ${tipo} (* Obligatorio)`;
            alertaAporte.innerText = "El enlace multimedia será visible para quienes consulten este aporte.";
        }
        
        labelUrl.innerHTML = `${icon} <span>${reqText}</span>`;
        labelUrl.className = "campo-label obligatorio";
        alertaAporte.style.display = "block";
        if(contenedorEnlace) contenedorEnlace.classList.add("obligatorio");
    }
}

function renderizarChipsTipo() {
    const select = document.getElementById("aporte-tipo");
    const contenedor = document.getElementById("aporte-tipo-chips");
    if (!select || !contenedor) return;
    contenedor.innerHTML = "";
    Array.from(select.options).forEach(opcion => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `tipo-chip ${claseChipTipo(opcion.value)}${opcion.value === select.value ? " active" : ""}`;
        chip.dataset.valor = opcion.value;
        chip.innerHTML = `<span>${iconoTipoAporte(opcion.value)}</span><span>${opcion.text.split("(")[0].trim()}</span>`;
        chip.addEventListener("click", () => {
            if (select.value === opcion.value) return;
            select.value = opcion.value;
            select.dispatchEvent(new Event("change"));
        });
        contenedor.appendChild(chip);
    });
}

function actualizarProgresoAporte() {
    const banner = document.getElementById("progreso-aporte");
    if (!banner) return;
    const tipo = document.getElementById("aporte-tipo")?.value;

    if (nodoActivoId === NODO_FRECUENCIA_ID && tipo === "audio") {
        const audios = contarAudiosDeFrecuencia();
        banner.innerHTML = `🎧 Este audio cuenta para la meta de <strong>Frecuencia Emancipada</strong>: <strong>${audios}/${META_AUDIOS}</strong>`;
        banner.className = "progreso-aporte-banner activo";
    } else if (nodoActivoId === NODO_APERTURA_ID && (tipo === "texto" || tipo === "video")) {
        const elementos = contarElementosDelRizoma();
        banner.innerHTML = `▶️ Este elemento cuenta para liberar el <strong>rizoma completo</strong>: <strong>${elementos}/${META_ELEMENTOS}</strong>`;
        banner.className = "progreso-aporte-banner activo";
    } else {
        banner.innerHTML = `Este aporte es libre: enriquece la conversación pero no afecta ninguna meta de desbloqueo.`;
        banner.className = "progreso-aporte-banner neutro";
    }
}

function mostrarErrorAporte(mensaje) {
    const cajaError = document.getElementById("aporte-error-inline");
    if (!cajaError) { alert(mensaje); return; }
    cajaError.innerText = mensaje;
    cajaError.classList.remove("gone");
    cajaError.classList.remove("shake"); void cajaError.offsetWidth; cajaError.classList.add("shake");
}
function ocultarErrorAporte() {
    const cajaError = document.getElementById("aporte-error-inline");
    if (cajaError) { cajaError.classList.add("gone"); cajaError.innerText = ""; }
}

function renderizarAportes(idNodo) {
    const muro = document.getElementById("muro-aportes"); if(muro) muro.innerHTML = "";
    const aportes = aportesData.filter(a => String(a.idNodo) === String(idNodo));
    const contador = document.getElementById("contador-aportes-nodo");
    if (contador) contador.innerText = idNodo === NODO_INICIAL_ID ? `${aportes.length} ${aportes.length === 1 ? "opinión" : "opiniones"}` : `${aportes.length} ${aportes.length === 1 ? "reflexión" : "reflexiones"}`;
    if (aportes.length === 0) { muro.innerHTML = `<p style="color:var(--text-muted); grid-column: 1 / -1;">Sin reflexiones aún. Ayuda a expandir el rizoma aportando tu visión aquí arriba.</p>`; return; }

    aportes.slice().reverse().forEach(aporte => {
        const tipo = String(aporte.tipo || "texto").toLowerCase();
        muro.innerHTML += `
            <div class="aporte-card ${claseColorAporte(tipo)}">
                <div class="aporte-meta">
                    <span class="aporte-meta-left">
                        <span class="aporte-tipo-badge">${iconoTipoAporte(tipo)} ${etiquetaTipoAporte(tipo)}</span>
                        <span>👤 ${escaparHTML(aporte.autor || 'Anónimo')} • 📍 ${escaparHTML(aporte.ubicacion || 'Territorio Digital')}</span>
                    </span>
                    <span>${escaparHTML(aporte.fecha)}</span>
                </div>
                <div class="aporte-txt">${escaparHTML(aporte.texto)}</div>
                ${generarMediaAporte(aporte)}
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
        
        const btnVisor = e.target.closest(".btn-abrir-visor");
        if (btnVisor) {
            const id = btnVisor.getAttribute("data-id");
            abrirVisorMultimedia(id);
        }
        
        const btnUnlock = e.target.closest(".btn-abrir-desbloqueo");
        if (btnUnlock) {
            nodoActivoId = btnUnlock.getAttribute("data-id"); 
            document.getElementById("decoder-modal").classList.remove("gone"); 
            document.getElementById("transmedia-key").value = "";
            document.getElementById("modal-error").classList.add("gone");
        }

        const btnBloq = e.target.closest(".btn-bloqueado");
        if (btnBloq) {
            e.preventDefault();
            mostrarProhibido();
        }
    });

    document.getElementById("btn-unlock").addEventListener("click", () => {
        const clave = document.getElementById("transmedia-key").value.trim().toUpperCase();
        const nodo = nodosData.find(n => String(n.id) === String(nodoActivoId));
        
        if (nodo && (nodo.clave || "").trim().toUpperCase() === clave) {
            const btnDesbloquear = document.getElementById("btn-unlock");
            nodo.estado = "unlocked";
            document.getElementById("decoder-modal").classList.add("gone");
            
            let nodosLiberadosLocal = [];
            try { nodosLiberadosLocal = JSON.parse(localStorage.getItem("nodosDesbloqueados")) || []; } catch (error) { localStorage.removeItem("nodosDesbloqueados"); }
            if (!nodosLiberadosLocal.includes(nodoActivoId)) {
                nodosLiberadosLocal.push(nodoActivoId);
                localStorage.setItem("nodosDesbloqueados", JSON.stringify(nodosLiberadosLocal));
            }
            
            renderizarNodos(); 
            abrirVisorMultimedia(nodoActivoId);
        } else {
            document.getElementById("modal-error").classList.remove("gone");
        }
    });

    document.getElementById("btn-fab-crear").addEventListener("click", () => {
        const audiosFrecuencia = contarAudiosDeFrecuencia();
        if (!rizomaDesbloqueado()) {
            const avance = tercerNodoDesbloqueado() ? contarElementosDelRizoma() : audiosFrecuencia;
            const meta = tercerNodoDesbloqueado() ? META_ELEMENTOS : META_AUDIOS;
            const faltan = meta - avance;
            
            document.getElementById("restriccion-contador").innerText = avance;
            document.getElementById("restriccion-meta").innerText = meta;
            
            const modalTitle = document.querySelector("#restriccion-modal h2");
            const modalDesc = document.querySelector("#restriccion-modal p");
            
            if (tercerNodoDesbloqueado()) {
                modalTitle.innerText = "⏳ RIZOMA CASI LIBRE";
                modalTitle.style.color = "#f59e0b";
                modalDesc.innerText = `Faltan ${faltan} elemento(s) en Pedagogía crítica virtual para completar la liberación del rizoma. ¡La comunidad está muy cerca!`;
            } else {
                modalTitle.innerText = "🔒 RED BLOQUEADA";
                modalTitle.style.color = "var(--danger)";
                modalDesc.innerText = `Se necesitan ${META_AUDIOS} audio(s) en Frecuencia Emancipada para abrir Pedagogía crítica virtual. Sube una evidencia sonora de tu territorio.`;
            }
            
            document.getElementById("restriccion-modal").classList.remove("gone");
            return;
        }
        
        document.getElementById("crear-nodo-modal").classList.remove("gone");
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
        
        nodosData.push(nuevoNodo); renderizarNodos(); document.getElementById("crear-nodo-modal").classList.add("gone");
        await enviarADrive("CREAR_NODO", nuevoNodo);
        btnGuardar.innerText = "Crear Nodo Libre"; btnGuardar.disabled = false; limpiarFormularioNodo();
    });

    document.getElementById("aporte-tipo").addEventListener("change", () => {
        actualizarCampoUrlSegunTipo();
        renderizarChipsTipo();
        actualizarProgresoAporte();
        ocultarErrorAporte();
    });

    const aporteTexto = document.getElementById("aporte-texto");
    const contadorCaracteres = document.getElementById("contador-caracteres-aporte");
    if(aporteTexto) {
        aporteTexto.maxLength = 1000;
        aporteTexto.addEventListener("input", () => {
            contadorCaracteres.innerText = `${aporteTexto.value.length} / 1000`;
            ocultarErrorAporte();
        });
    }

    document.getElementById("btn-enviar-aporte").addEventListener("click", async () => {
        const texto = document.getElementById("aporte-texto").value.trim(); 
       if (!texto) {
            document.getElementById("reflexion-vacia-modal").classList.remove("gone");
            return;
        }
        
        ocultarErrorAporte();
        const tipoAporte = document.getElementById("aporte-tipo").value;
        const urlAporte = document.getElementById("aporte-url").value.trim();

        if (nodoActivoId === NODO_FRECUENCIA_ID && tipoAporte !== "audio") {
            mostrarErrorAporte("Esta frecuencia recibe únicamente audios de máximo 30 segundos."); return;
        }
        
        if (nodoActivoId === NODO_APERTURA_ID && tipoAporte !== "texto" && tipoAporte !== "video") {
            mostrarErrorAporte("El tercer nodo permite únicamente texto limpio o video."); return;
        }

        if ((tipoAporte === "audio" || tipoAporte === "video" || tipoAporte === "imagen") && !urlAporte) {
            mostrarErrorAporte(`Elegiste incrustar '${tipoAporte}'. El enlace del archivo multimedia es obligatorio.`); return;
        }
        if (urlAporte && obtenerURLSegura(urlAporte) === "#") {
            mostrarErrorAporte("Introduce un enlace web válido que comience por http:// o https://."); return;
        }

        const btnAporte = document.getElementById("btn-enviar-aporte"); btnAporte.innerText = "Transmitiendo..."; btnAporte.disabled = true;
        const fechaActual = new Date().toLocaleDateString('es-CO');
        
        const nuevoAporte = {
            idAporte: "A-" + Date.now(), idNodo: nodoActivoId,
            tipo: tipoAporte, autor: document.getElementById("aporte-autor").value.trim() || "Anónimo", 
            ubicacion: document.getElementById("aporte-ubicacion").value.trim() || "Territorio local", texto: texto, url: urlAporte, fecha: fechaActual
        };

        // --- REGISTRO DEL PROGRESO INDIVIDUAL (LOCAL) ---
        if (nodoActivoId === NODO_FRECUENCIA_ID && tipoAporte === "audio") {
            let misAudios = contarAudiosDeFrecuencia() + 1;
            localStorage.setItem("misAudiosFrecuencia", misAudios);
            
            if (misAudios >= META_AUDIOS) {
                let nodosLiberadosLocal = JSON.parse(localStorage.getItem("nodosDesbloqueados")) || [];
                if (!nodosLiberadosLocal.includes(NODO_APERTURA_ID)) {
                    nodosLiberadosLocal.push(NODO_APERTURA_ID);
                    localStorage.setItem("nodosDesbloqueados", JSON.stringify(nodosLiberadosLocal));
                }
            }
        } else if (nodoActivoId === NODO_APERTURA_ID) {
            if (tipoAporte === "texto" || tipoAporte === "video") {
                let misElementos = contarElementosDelRizoma() + 1;
                localStorage.setItem("misElementosRizoma", misElementos);
            }
        }

        aportesData.push(nuevoAporte); 
        renderizarAportes(nodoActivoId);
        renderizarNodos(); 
        
        try {
            const exito = await enviarADrive("NUEVO_APORTE", nuevoAporte);
            if (!exito && GOOGLE_SCRIPT_URL !== "") { console.warn("Fallo el guardado en Drive, pero se mantiene en sesión local."); }
        } catch (e) {
            console.error("Error al enviar aporte:", e);
        }
        
        btnAporte.innerText = "Transmitir Reflexión"; btnAporte.disabled = false; limpiarFormularioAporte();
    });

    document.querySelectorAll(".close-btn").forEach(btn => {
        btn.addEventListener("click", (e) => { e.target.closest(".overlay").classList.add("gone"); });
    });

    const btnIniciar = document.getElementById("btn-iniciar-experiencia");
    if (btnIniciar) {
        btnIniciar.addEventListener("click", () => {
            localStorage.setItem(MEMORIA_INICIO, "true");
            document.getElementById("onboarding-modal").classList.add("gone");
            renderizarNodos();
        });
    }

    const btnIrARed = document.getElementById("btn-ir-a-red");
    if (btnIrARed) {
        btnIrARed.addEventListener("click", () => {
            document.getElementById("mision-modal")?.classList.add("gone");
            const canvas = document.getElementById("rhizome-canvas");
            if (canvas) canvas.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

    const btnBuscarNav = document.getElementById("btn-buscar-nodo-nav");
    const inputBuscar = document.getElementById("input-buscar-nodo");

    if (btnBuscarNav && inputBuscar) {
        const ejecutarBusqueda = () => {
            const terminoBusqueda = inputBuscar.value.trim().toLowerCase();
            if (!terminoBusqueda) return;

            let nodoEncontrado = null;
            let posibleId = terminoBusqueda.toUpperCase();
            if (!posibleId.startsWith("N-") && !isNaN(posibleId.charAt(0))) { posibleId = "N-" + posibleId; }

            nodoEncontrado = nodosData.find(n => String(n.id).toUpperCase() === posibleId || String(n.id).toUpperCase() === terminoBusqueda.toUpperCase());
            if (!nodoEncontrado) { nodoEncontrado = nodosData.find(n => String(n.titulo).toLowerCase().includes(terminoBusqueda)); }

            if (nodoEncontrado) {
                const tarjetaDestino = document.getElementById(`tarjeta-${nodoEncontrado.id}`);
                if (tarjetaDestino) {
                    tarjetaDestino.scrollIntoView({ behavior: "smooth", block: "center" });
                    const colorOriginal = tarjetaDestino.style.backgroundColor;
                    const sombraOriginal = tarjetaDestino.style.boxShadow;
                    
                    tarjetaDestino.style.transition = "all 0.5s ease";
                    tarjetaDestino.style.backgroundColor = "rgba(16, 185, 129, 0.2)"; 
                    tarjetaDestino.style.boxShadow = "0 0 20px rgba(16, 185, 129, 0.6)";

                    setTimeout(() => { tarjetaDestino.style.backgroundColor = colorOriginal; tarjetaDestino.style.boxShadow = sombraOriginal; }, 2000);
                } else { alert(`El nodo "${nodoEncontrado.titulo}" existe, pero está oculto.`); }
            } else { alert(`No se encontró ningún nodo que coincida con "${inputBuscar.value}".`); }
        };

        btnBuscarNav.addEventListener("click", ejecutarBusqueda);
        inputBuscar.addEventListener("keypress", (e) => { if (e.key === "Enter") { e.preventDefault(); ejecutarBusqueda(); } });
    }
}

function limpiarFormularioNodo() {
    document.getElementById("nuevo-titulo").value = ""; document.getElementById("nuevo-autor").value = "";
    document.getElementById("nuevo-url").value = ""; document.getElementById("nuevo-desc").value = ""; document.getElementById("nuevo-tipo").value = "Artículo"; 
    const totalAportes = aportesData.length;
    document.getElementById("nuevo-nivel").value = totalAportes >= 5 ? "BASE" : "SUB";
    document.getElementById("nuevo-nivel").dispatchEvent(new Event('change'));
}

function limpiarFormularioAporte() {
    document.getElementById("aporte-texto").value = ""; document.getElementById("aporte-url").value = ""; 
    const selectorTipo = document.getElementById("aporte-tipo");
    selectorTipo.value = selectorTipo.querySelector("option[value='texto']") ? "texto" : selectorTipo.options[0]?.value || "";
    document.getElementById("aporte-autor").value = ""; document.getElementById("aporte-ubicacion").value = "";
    const contadorCaracteres = document.getElementById("contador-caracteres-aporte");
    if (contadorCaracteres) contadorCaracteres.innerText = "0 / 1000";
    ocultarErrorAporte();
    actualizarCampoUrlSegunTipo();
    renderizarChipsTipo();
    actualizarProgresoAporte();
}
