const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyiNuNnVgV4wwmD6WSKmS15d3p-TFTX2zHd-IWJigJglstvNGNG_aTDIPAtHXB49oQ/exec"; 

let nodosData = [];
let aportesData = [];
let conexionesData = []; 
let filtroMapa = "todos";
const META_AUDIOS = 2; 
const META_ELEMENTOS = 3; 
const NODO_FRECUENCIA_ID = "N-002";
const NODO_APERTURA_ID = "N-003";

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

function obtenerTemaRaiz(nodo) {
    const partes = String(nodo.tema || "").split("|||");
    return partes[0] === "SUB" ? partes[2] : "";
}

function contarAudiosDeFrecuencia() {
    return parseInt(localStorage.getItem("misAudiosFrecuencia") || "0", 10);
}

function contarElementosDelRizoma() {
    return parseInt(localStorage.getItem("misElementosRizoma") || "0", 10);
}

function puedeVerMapa() {
    const videoVisto = localStorage.getItem("archivoVideoInicialVisto") === "true";
    return videoVisto && contarAudiosDeFrecuencia() >= META_AUDIOS && contarElementosDelRizoma() >= META_ELEMENTOS;
}

function puedeTrazarConexion() {
    return contarElementosDelRizoma() >= META_ELEMENTOS;
}

document.addEventListener("DOMContentLoaded", async () => {
    await cargarDatosDesdeDrive();

    document.getElementById("filtro-mapa").addEventListener("change", evento => {
        filtroMapa = evento.target.value;
        dibujarRedRizomatica();
    });

    document.getElementById("btn-ajustar-mapa").addEventListener("click", () => {
        if (window.network) window.network.fit({ animation: true });
    });
    
    document.getElementById("btn-activar-conexion").addEventListener("click", () => {
        if(window.network) {
            window.network.addEdgeMode();
            document.getElementById("estado-conexion").style.display = "inline";
            document.getElementById("btn-activar-conexion").style.display = "none";
        }
    });
});

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

function actualizarTextosGlobales() {
    const subtitle = document.querySelector(".subtitle");
    if (!subtitle) return;
    
    if (puedeTrazarConexion()) {
        subtitle.innerText = "RED LIBERADA · CONEXIONES TRANSVERSALES DISPONIBLES";
        subtitle.style.color = "var(--teal)";
    } else if (contarAudiosDeFrecuencia() >= META_AUDIOS) {
        const faltan = META_ELEMENTOS - contarElementosDelRizoma();
        subtitle.innerText = `RED CASI LIBRE · FALTAN ${faltan} ELEMENTOS PARA COMPLETAR`;
        subtitle.style.color = "#f59e0b";
    } else {
        subtitle.innerText = "RED BLOQUEADA · ESPERANDO ACCIONES COMUNITARIAS";
        subtitle.style.color = "var(--danger)";
    }
}

async function cargarDatosDesdeDrive() {
    try {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=leerDatos`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        nodosData = data.nodos || [];
        aportesData = data.aportes || [];
        conexionesData = data.conexiones || [];
        
        aplicarProgresoLocal(); 
        actualizarTextosGlobales(); 
        
        document.getElementById("loading-text").style.display = "none";
        dibujarRedRizomatica();
        actualizarBloqueoMapa();
        actualizarEstadoConexion();
    } catch (error) {
        console.error("Fallo la conexión:", error);
    }
}

function actualizarEstadoConexion() {
    const boton = document.getElementById("btn-activar-conexion");
    if (!boton) return;
    const libres = puedeTrazarConexion();
    boton.disabled = !libres;
    
    if (!libres) {
        const faltan = META_ELEMENTOS - contarElementosDelRizoma();
        boton.innerText = `Disponible pronto · faltan ${faltan} elemento(s)`;
        boton.title = "La conexión transversal se habilita cuando el rizoma se libere.";
        boton.style.background = "rgba(0,0,0,0.5)";
        boton.style.borderColor = "#f59e0b";
        boton.style.color = "#f59e0b";
    } else {
        boton.innerText = "Trazar conexión transversal";
        boton.title = "El rizoma está libre. Conecta cualquier nodo de forma transversal.";
        boton.style.background = "var(--teal)";
        boton.style.borderColor = "var(--teal)";
        boton.style.color = "var(--ink)";
    }
}

function actualizarBloqueoMapa() {
    const bloqueo = document.getElementById("mapa-bloqueado");
    if (bloqueo) bloqueo.classList.toggle("hidden", puedeVerMapa());
}

async function guardarConexionEnDrive(origen, destino) {
    if(GOOGLE_SCRIPT_URL === "") return;
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({ accion: "NUEVA_CONEXION", datos: { origen: origen, destino: destino } }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
    } catch (e) { console.error("Error guardando conexión", e); }
}

function dibujarRedRizomatica() {
    const nodes = [];
    const edges = [];
    const idsVisibles = new Set();
    const mapaBloqueado = !puedeVerMapa();

    actualizarResumen();

    nodosData.forEach(nodo => {
        if (filtroMapa === "aportes") return;
        if (mapaBloqueado && !["N-001", "N-002", "N-003"].includes(String(nodo.id))) return;
        
        let esBase = false;
        let colorNodo = "#a1a1aa";
        let labelFinal = nodo.titulo;
        
        if (nodo.tema && nodo.tema.includes("|||")) {
            const partes = nodo.tema.split("|||");
            esBase = (partes[0] === "BASE");
            colorNodo = partes[1];
        }

        if (nodo.estado === "locked") {
            labelFinal = "🔒 " + (nodo.id === "N-003" ? "NODO ENCRIPTADO" : "NODO ENCRIPTADO");
            colorNodo = "#3f3f46"; 
        } else if (esBase) {
            labelFinal = nodo.titulo.toUpperCase();
        }
        if (mapaBloqueado) {
            labelFinal = "✦ NODO RESTRINGIDO";
            colorNodo = "#344a64";
        }

        if (esBase) {
            nodes.push({ id: nodo.id, label: labelFinal, title: nodo.estado === "locked" ? "Nodo protegido." : `[TEMA BASE] ID: ${nodo.id}\nAutor: ${nodo.autor || 'Anónimo'}`, shape: 'dot', size: 25, color: { background: colorNodo, border: '#ffffff', highlight: { border: '#ffffff' } }, font: { color: '#ffffff', size: 14, bold: true } });
            idsVisibles.add(nodo.id);
        } else {
            nodes.push({ id: nodo.id, label: labelFinal, title: nodo.estado === "locked" ? "Nodo protegido." : `[SUB-NODO] ID: ${nodo.id}\nTipo: ${nodo.tipo}\nAutor: ${nodo.autor || 'Anónimo'}`, shape: 'dot', size: 15, color: { background: colorNodo, border: '#ffffff' }, font: { color: '#f4f4f5' } });
            idsVisibles.add(nodo.id);
            if (!mapaBloqueado) {
                const temaRaiz = obtenerTemaRaiz(nodo);
                const nodoPadre = nodosData.find(posiblePadre => {
                    const partes = String(posiblePadre.tema || "").split("|||");
                    return partes[0] === "BASE" && (partes[2] || posiblePadre.titulo) === temaRaiz;
                });
                if (nodoPadre && idsVisibles.has(nodoPadre.id)) {
                    edges.push({ from: nodo.id, to: nodoPadre.id, color: { color: colorNodo, opacity: 0.65 }, width: 2, length: 80 });
                }
            }
        }
    });

    aportesData.forEach((aporte, index) => {
        if (filtroMapa === "nodos" || mapaBloqueado) return;
        const idAporte = aporte.idAporte || `APORTE_${index}`;
        const nodoPadre = nodosData.find(n => String(n.id) === String(aporte.idNodo));
        let colorLinea = "#3f3f46"; 
        if(nodoPadre && nodoPadre.tema && nodoPadre.tema.includes("|||")) { colorLinea = nodoPadre.tema.split("|||")[1]; }

        nodes.push({ id: idAporte, label: aporte.autor || 'Anónimo', title: `[APORTE] ID: ${idAporte}\n\n${aporte.texto}`, group: 'aporte', shape: 'box', size: 12, color: { background: '#1d304b', border: colorLinea }, font: { color: '#a1a1aa', size: 11 } });
        idsVisibles.add(idAporte);
        if (idsVisibles.has(aporte.idNodo)) edges.push({ from: idAporte, to: aporte.idNodo, color: { color: colorLinea, opacity: 0.4 }, length: 40 });
    });

    conexionesData.forEach(conn => {
        if (!idsVisibles.has(conn.origen) || !idsVisibles.has(conn.destino)) return;
        edges.push({ from: conn.origen, to: conn.destino, color: { color: '#8b5cf6', opacity: 0.8 }, dashes: true, width: 1.5 });
    });

    const container = document.getElementById('mynetwork');
    const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
    
    const options = {
        nodes: { borderWidth: 2, shadow: true }, edges: { smooth: { type: 'continuous' } },
        physics: { solver: 'forceAtlas2Based', forceAtlas2Based: { gravitationalConstant: -50, centralGravity: 0.005, springLength: 100, springConstant: 0.08, damping: 0.4 }, maxVelocity: 50, minVelocity: 1.5, timestep: 0.5, stabilization: { enabled: true, iterations: 200, fit: true } },
        interaction: { hover: true, tooltipDelay: 200, zoomView: true, dragView: true },
        manipulation: {
            enabled: false,
            addEdge: function (data, callback) {
                if (data.from === data.to) { alert("Un rizoma se conecta con otros elementos, no consigo mismo."); return; }
                if(confirm("¿Establecer conexión con el rizoma?")) {
                    data.color = { color: '#8b5cf6', opacity: 0.8 }; data.dashes = true; data.width = 1.5;
                    callback(data); guardarConexionEnDrive(data.from, data.to); 
                    document.getElementById("estado-conexion").style.display = "none";
                    document.getElementById("btn-activar-conexion").style.display = "inline-block";
                    window.network.disableEditMode();
                }
            }
        }
    };
    if (window.network) window.network.destroy();
    window.network = new vis.Network(container, data, options);
    window.network.on("click", evento => { if (!mapaBloqueado && evento.nodes.length) mostrarDetalle(evento.nodes[0]); });
}

function actualizarResumen() {
    document.getElementById("total-nodos").innerText = nodosData.length;
    document.getElementById("total-aportes").innerText = aportesData.length;
    document.getElementById("total-conexiones").innerText = conexionesData.length;
}

function mostrarDetalle(id) {
    const panel = document.getElementById("detalle-mapa");
    const nodo = nodosData.find(elemento => String(elemento.id) === String(id));
    const aporte = aportesData.find((elemento, index) => String(elemento.idAporte || `APORTE_${index}`) === String(id));

    if (nodo) {
        const tema = nodo.tema ? nodo.tema.split("|||")[2] || "Sin tema asignado" : "Sin tema asignado";
        const reflexiones = aportesData.filter(elemento => String(elemento.idNodo) === String(nodo.id)).length;
        const recurso = obtenerURLSegura(nodo.url);
        panel.classList.remove("empty");
        panel.innerHTML = `<span class="detail-label">${nodo.estado === "locked" ? "Nodo protegido" : "Nodo de investigación"}</span>
            <h3 class="detail-title">${escaparHTML(nodo.estado === "locked" ? "Nodo encriptado" : nodo.titulo)}</h3>
            <div class="detail-meta" style="color: #cbd5e1;">ID ${escaparHTML(nodo.id)}<br>Autor: ${escaparHTML(nodo.autor || "Anónimo")}<br>Tema: ${escaparHTML(tema)}<br>${reflexiones} reflexiones vinculadas</div>
            <p class="detail-text" style="color: #fff;">${escaparHTML(nodo.estado === "locked" ? "Este contenido está protegido. Accede al Territorio Central para desencriptarlo." : nodo.descripcion || "Este nodo todavía no tiene una descripción.")}</p>
            ${nodo.estado === "locked" ? "" : `<a class="detail-link" style="color: var(--teal);" href="${escaparHTML(recurso)}" target="_blank" rel="noopener noreferrer">Abrir recurso transmedia ↗</a>`}`;
        return;
    }
    if (aporte) {
        const recurso = obtenerURLSegura(aporte.url);
        panel.classList.remove("empty");
        panel.innerHTML = `<span class="detail-label">Reflexión comunitaria</span>
            <h3 class="detail-title">${escaparHTML(aporte.autor || "Anónimo")}</h3>
            <div class="detail-meta" style="color: #cbd5e1;">ID ${escaparHTML(aporte.idAporte || id)}<br>Ubicación: ${escaparHTML(aporte.ubicacion || "Territorio digital")}<br>Fecha: ${escaparHTML(aporte.fecha || "Sin fecha")}</div>
            <p class="detail-text" style="color: #fff;">${escaparHTML(aporte.texto || "Sin texto registrado.")}</p>
            ${aporte.url ? `<a class="detail-link" style="color: var(--teal);" href="${escaparHTML(recurso)}" target="_blank" rel="noopener noreferrer">Abrir enlace adjunto ↗</a>` : ""}`;
    }
}
