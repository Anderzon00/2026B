const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby5eI8b_EJ1eFIlQfujBhwgmgHmhrsGSwQRQEO3p7rgaBNrHZcZXrud2DbZrr1s4ne63g/exec"; 

let nodosData = [];
let aportesData = [];
let conexionesData = []; 
let filtroMapa = "todos";
const META_AUDIOS = 10;
const META_VIDEOS = 15;
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

function puedeVerMapa() {
    const videoVisto = localStorage.getItem("archivoVideoInicialVisto") === "true";
    const audios = aportesData.filter(aporte => String(aporte.idNodo) === NODO_FRECUENCIA_ID && String(aporte.tipo).toLowerCase() === "audio").length;
    return videoVisto && audios >= META_AUDIOS;
}

function puedeTrazarConexion() {
    return aportesData.filter(aporte => String(aporte.idNodo) === NODO_APERTURA_ID && String(aporte.tipo).toLowerCase() === "video").length >= META_VIDEOS;
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
    const progresoGuardado = localStorage.getItem("nodosDesbloqueados");
    if (progresoGuardado) {
        let nodosLiberadosLocal = [];
        try { nodosLiberadosLocal = JSON.parse(progresoGuardado); } catch (error) { localStorage.removeItem("nodosDesbloqueados"); }
        nodosLiberadosLocal.forEach(idLocal => {
            const nodoEnRed = nodosData.find(n => String(n.id) === String(idLocal));
            if (nodoEnRed) { nodoEnRed.estado = "unlocked"; }
        });
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
        
        aplicarProgresoLocal(); // Sincronizar el estado de los candados localmente
        
        document.getElementById("loading-text").style.display = "none";
        dibujarRedRizomatica();
        actualizarBloqueoMapa();
        actualizarEstadoConexion();
    } catch (error) {
        console.error("Fallo la conexión:", error);
        document.getElementById("loading-text").innerText = "Modo contingencia (Visualizando datos locales)";
        
        // Datos de contingencia actualizados
        nodosData = [
            { id: "N-001", titulo: "El Paradigma del Árbol", autor: "Sistema", tipo: "Artículo", tema: "BASE|||#ef4444|||Paradigma Tradicional", estado: "unlocked" },
            { id: "N-002", titulo: "Frecuencia Emancipada", autor: "Profesor Cartográfico", tipo: "Podcast", tema: "BASE|||#10b981|||El Rizoma", estado: "locked" },
            { id: "N-003", titulo: "Pedagogía Crítica Virtual", autor: "e-MEV", tipo: "Artículo", tema: "BASE|||#8b5cf6|||Pedagogía Crítica", estado: "locked" }
        ];
        aportesData = [{ idAporte: "A-1001", idNodo: "N-001", autor: "Sistema", texto: "Prueba" }];
        conexionesData = [{origen: "A-1001", destino: "N-001"}];
        
        aplicarProgresoLocal();
        dibujarRedRizomatica();
        actualizarBloqueoMapa();
        actualizarEstadoConexion();
    }
}

function actualizarEstadoConexion() {
    const boton = document.getElementById("btn-activar-conexion");
    if (!boton) return;
    boton.disabled = !puedeTrazarConexion();
    boton.title = boton.disabled ? "Disponible cuando el rizoma alcance 15 videos" : "Trazar una conexión transversal";
    if (boton.disabled) boton.innerText = "Conexiones libres: 0/15 videos";
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
        console.log(`Conexión trazada de ${origen} a ${destino}`);
    } catch (e) { console.error("Error guardando conexión", e); }
}

function dibujarRedRizomatica() {
    const nodes = [];
    const edges = [];
    const idsVisibles = new Set();
    const mapaBloqueado = !puedeVerMapa();

    actualizarResumen();

    // Nodos Principales
    nodosData.forEach(nodo => {
        if (filtroMapa === "aportes") return;
        if (mapaBloqueado && !["N-001", "N-002", "N-003"].includes(String(nodo.id))) return;
        // ERROR CORREGIDO: Ya no ocultamos los nodos con && nodo.id !== 'N-002'
        
        let esBase = false;
        let colorNodo = "#a1a1aa";
        let labelFinal = nodo.titulo;
        
        if (nodo.tema && nodo.tema.includes("|||")) {
            const partes = nodo.tema.split("|||");
            esBase = (partes[0] === "BASE");
            colorNodo = partes[1];
        }

        // Si el nodo sigue bloqueado (el usuario no lo ha desencriptado), lo mostramos como enigmático
        if (nodo.estado === "locked") {
            labelFinal = "🔒 " + (nodo.id === "N-003" ? "NODO ENCRIPTADO" : "NODO ENCRIPTADO");
            colorNodo = "#3f3f46"; // Gris oscuro para ocultar su color real
        } else if (esBase) {
            labelFinal = nodo.titulo.toUpperCase();
        }
        if (mapaBloqueado) {
            labelFinal = "✦ NODO RESTRINGIDO";
            colorNodo = "#344a64";
        }

        if (esBase) {
            nodes.push({ 
                id: nodo.id, 
                label: labelFinal, 
                title: nodo.estado === "locked" ? "Nodo protegido. Desbloquéalo en el Territorio Central." : `[TEMA BASE] ID: ${nodo.id}\nAutor: ${nodo.autor || 'Anónimo'}`, 
                shape: 'dot', 
                size: 25, 
                color: { background: colorNodo, border: '#ffffff', highlight: { border: '#ffffff' } }, 
                font: { color: '#ffffff', size: 14, bold: true } 
            });
            idsVisibles.add(nodo.id);
        } else {
            nodes.push({ 
                id: nodo.id, 
                label: labelFinal, 
                title: nodo.estado === "locked" ? "Nodo protegido." : `[SUB-NODO] ID: ${nodo.id}\nTipo: ${nodo.tipo}\nAutor: ${nodo.autor || 'Anónimo'}`, 
                shape: 'dot',
                size: 15,
                color: { background: colorNodo, border: '#ffffff' }, 
                font: { color: '#f4f4f5' } 
            });
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

    // Aportes de la Comunidad
    aportesData.forEach((aporte, index) => {
        if (filtroMapa === "nodos" || mapaBloqueado) return;
        const idAporte = aporte.idAporte || `APORTE_${index}`;
        const nodoPadre = nodosData.find(n => String(n.id) === String(aporte.idNodo));
        let colorLinea = "#3f3f46"; 
        
        if(nodoPadre && nodoPadre.tema && nodoPadre.tema.includes("|||")) {
            colorLinea = nodoPadre.tema.split("|||")[1];
        }

        nodes.push({
            id: idAporte, label: aporte.autor || 'Anónimo', title: `[APORTE] ID: ${idAporte}\n\n${aporte.texto}`, group: 'aporte', shape: 'box', size: 12, color: { background: '#1d304b', border: colorLinea }, font: { color: '#a1a1aa', size: 11 }
        });
        idsVisibles.add(idAporte);
        if (idsVisibles.has(aporte.idNodo)) edges.push({ from: idAporte, to: aporte.idNodo, color: { color: colorLinea, opacity: 0.4 }, length: 40 });
    });

    // Conexiones Transversales
    conexionesData.forEach(conn => {
        if (!idsVisibles.has(conn.origen) || !idsVisibles.has(conn.destino)) return;
        edges.push({
            from: conn.origen, 
            to: conn.destino, 
            color: { color: '#8b5cf6', opacity: 0.8 }, 
            dashes: true, 
            width: 1.5 
        });
    });

    const container = document.getElementById('mynetwork');
    const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
    
    const options = {
        nodes: { borderWidth: 2, shadow: true },
        edges: { smooth: { type: 'continuous' } },
        physics: { 
            solver: 'forceAtlas2Based', 
            forceAtlas2Based: { 
                gravitationalConstant: -50, 
                centralGravity: 0.005, 
                springLength: 100, 
                springConstant: 0.08 
            }, 
            maxVelocity: 50, minVelocity: 0.1, timestep: 0.5 
        },
        interaction: { hover: true, tooltipDelay: 200, zoomView: true, dragView: true },
        manipulation: {
            enabled: false,
            addEdge: function (data, callback) {
                if (data.from === data.to) { alert("Un rizoma se conecta con otros elementos, no consigo mismo."); return; }
                if(confirm("¿Establecer conexión transversal en el rizoma educativo?")) {
                    data.color = { color: '#8b5cf6', opacity: 0.8 };
                    data.dashes = true;
                    data.width = 1.5;
                    
                    callback(data); 
                    guardarConexionEnDrive(data.from, data.to); 
                    
                    document.getElementById("estado-conexion").style.display = "none";
                    document.getElementById("btn-activar-conexion").style.display = "inline-block";
                    window.network.disableEditMode();
                }
            }
        }
    };
    if (window.network) window.network.destroy();
    window.network = new vis.Network(container, data, options);
    window.network.on("click", evento => {
        if (!mapaBloqueado && evento.nodes.length) mostrarDetalle(evento.nodes[0]);
    });
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
            <div class="detail-meta">ID ${escaparHTML(nodo.id)}<br>Autor: ${escaparHTML(nodo.autor || "Anónimo")}<br>Tema: ${escaparHTML(tema)}<br>${reflexiones} reflexiones vinculadas</div>
            <p class="detail-text">${escaparHTML(nodo.estado === "locked" ? "Este contenido está protegido. Accede al Territorio Central para desencriptarlo." : nodo.descripcion || "Este nodo todavía no tiene una descripción.")}</p>
            ${nodo.estado === "locked" ? "" : `<a class="detail-link" href="${escaparHTML(recurso)}" target="_blank" rel="noopener noreferrer">Abrir recurso transmedia ↗</a>`}`;
        return;
    }

    if (aporte) {
        const recurso = obtenerURLSegura(aporte.url);
        panel.classList.remove("empty");
        panel.innerHTML = `<span class="detail-label">Reflexión comunitaria</span>
            <h3 class="detail-title">${escaparHTML(aporte.autor || "Anónimo")}</h3>
            <div class="detail-meta">ID ${escaparHTML(aporte.idAporte || id)}<br>Ubicación: ${escaparHTML(aporte.ubicacion || "Territorio digital")}<br>Fecha: ${escaparHTML(aporte.fecha || "Sin fecha")}</div>
            <p class="detail-text">${escaparHTML(aporte.texto || "Sin texto registrado.")}</p>
            ${aporte.url ? `<a class="detail-link" href="${escaparHTML(recurso)}" target="_blank" rel="noopener noreferrer">Abrir enlace adjunto ↗</a>` : ""}`;
    }
}
