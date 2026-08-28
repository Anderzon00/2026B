// ==========================================
// BACKEND - EL ARCHIVO DEL MAÑANA (RIZOMA e-MEV)
// ==========================================

function doPost(e) {
  const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  try {
    const body = JSON.parse(e.postData.contents);
    const accion = body.accion;
    const datos = body.datos;
    
    if (accion === "CREAR_NODO") { guardarNodo(datos); } 
    else if (accion === "NUEVO_APORTE") { guardarAporte(datos); } 
    else if (accion === "NUEVA_CONEXION") { registrarConexionTransversal(datos.origen, datos.destino); }
    else { throw new Error("Acción no reconocida"); }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  inicializarBaseDeDatos(); 
  sincronizarReglasIniciales();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNodos = ss.getSheetByName("Nodos");
  const sheetAportes = ss.getSheetByName("Aportes");
  const sheetConexiones = ss.getSheetByName("Conexiones");
  
  return ContentService.createTextOutput(JSON.stringify({ 
    nodos: leerHoja(sheetNodos), 
    aportes: leerHojaAportes(sheetAportes), 
    conexiones: sheetConexiones ? leerHoja(sheetConexiones) : [] 
  })).setMimeType(ContentService.MimeType.JSON);
}

function sincronizarReglasIniciales() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Nodos");
  if (!sheet) return;
  const datos = sheet.getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][0]) === "N-002") {
      if (String(datos[i][7] || "").trim() === "") sheet.getRange(i + 1, 8).setValue("2"); 
    }
    if (String(datos[i][0]) === "N-003" && String(datos[i][7] || "").trim() !== "") {
      sheet.getRange(i + 1, 8).clearContent();
    }
  }
}

function guardarNodo(nodo) {
  validarCampos(nodo, ["id", "titulo", "tipo", "url"]);
  if (contarElementosDelRizoma() < 3) throw new Error("El rizoma permanece bloqueado hasta reunir 3 elementos");
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Nodos").appendRow([
      limitarTexto(nodo.id, 80), limitarTexto(nodo.titulo, 200), limitarTexto(nodo.autor, 120),
      limitarTexto(nodo.descripcion, 2000), limitarTexto(nodo.tipo, 40), limitarTexto(nodo.tema, 200),
      limitarTexto(nodo.url, 500), limitarTexto(nodo.clave, 100), limitarTexto(nodo.estado, 30)
    ]);
  } finally { lock.releaseLock(); }
}

function contarElementosDelRizoma() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Aportes");
  if (!sheet) return 0;
  const datos = sheet.getDataRange().getValues();
  let total = 0;
  for (let i = 1; i < datos.length; i++) {
    const idNodo = String(datos[i][1]).trim();
    const tipo = String(datos[i][2]).trim().toLowerCase();
    if (idNodo === "N-003" && (tipo === "texto" || tipo === "video")) total++;
  }
  return total;
}

function guardarAporte(aporte) {
  validarCampos(aporte, ["idAporte", "idNodo", "texto"]);
  const idNodo = String(aporte.idNodo);
  const tipo = String(aporte.tipo || "").trim().toLowerCase();
  if (!["texto", "imagen", "audio", "video", "web"].includes(tipo)) {
    throw new Error("Tipo de aporte no permitido");
  }
  if (idNodo === "N-002" && tipo !== "audio") {
    throw new Error("Frecuencia Emancipada recibe únicamente aportes de audio");
  }
  if (idNodo === "N-003" && tipo !== "texto" && tipo !== "video") {
    throw new Error("El tercer nodo recibe únicamente aportes de texto limpio o video");
  }
  
  if (["imagen", "audio", "video"].includes(tipo) && String(aporte.url || "").trim() === "") {
    throw new Error(`El aporte tipo ${tipo} debe incluir un enlace público`);
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Aportes").appendRow([
      limitarTexto(aporte.idAporte, 80), 
      limitarTexto(aporte.idNodo, 80), 
      limitarTexto(aporte.tipo, 30),
      limitarTexto(aporte.autor, 120), 
      limitarTexto(aporte.ubicacion, 120), 
      limitarTexto(aporte.texto, 1000),
      limitarTexto(aporte.url, 500), 
      limitarTexto(aporte.fecha, 40)
    ]);
  } finally { lock.releaseLock(); }
}

function registrarConexionTransversal(origen, destino) {
  validarCampos({ origen: origen, destino: destino }, ["origen", "destino"]);
  if (contarElementosDelRizoma() < 3) throw new Error("Las conexiones libres se habilitan cuando el rizoma está liberado (3 elementos)");
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Conexiones");
  if(sheet) {
    const data = sheet.getDataRange().getValues();
    let existe = false;
    for(let i=1; i<data.length; i++) {
      if(String(data[i][0]) === String(origen) && String(data[i][1]) === String(destino)) { existe = true; break; }
    }
    if(!existe) { sheet.appendRow([origen, destino, new Date()]); }
  }
  } finally { lock.releaseLock(); }
}

function validarCampos(datos, campos) {
  campos.forEach(campo => {
    if (!datos || String(datos[campo] || "").trim() === "") throw new Error(`Campo obligatorio ausente: ${campo}`);
  });
}

function limitarTexto(valor, maximo) {
  return String(valor || "").trim().substring(0, maximo);
}

function leerHoja(sheet) {
  const data = sheet.getDataRange().getValues();
  if(data.length === 0) return [];
  const headers = data[0]; const rows = [];
  for (let i = 1; i < data.length; i++) {
    let rowObj = {};
    for (let j = 0; j < headers.length; j++) { rowObj[headers[j]] = data[i][j]; }
    rows.push(rowObj);
  }
  return rows;
}

function leerHojaAportes(sheet) {
  const data = sheet.getDataRange().getValues();
  if(data.length === 0) return [];
  const headers = data[0]; const rows = [];
  for (let i = 1; i < data.length; i++) {
    let rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      if (headers[j] === "enlacesRizoma") { rowObj[headers[j]] = data[i][j] ? String(data[i][j]).split(",") : []; } 
      else { rowObj[headers[j]] = data[i][j]; }
    }
    rows.push(rowObj);
  }
  return rows;
}

function inicializarBaseDeDatos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetNodos = ss.getSheetByName("Nodos");
  let sheetAportes = ss.getSheetByName("Aportes");
  let sheetConexiones = ss.getSheetByName("Conexiones");
  
  if (!sheetNodos) {
    sheetNodos = ss.insertSheet("Nodos");
    sheetNodos.appendRow(["id", "titulo", "autor", "descripcion", "tipo", "tema", "url", "clave", "estado"]);
    sheetNodos.appendRow(["N-001", "El umbral del archivo", "Alma, Beto y Gera", "Cortometraje inicial: descubre el vacío de información y encuentra la primera coordenada del Hipertexto.", "Video", "BASE|||#e7b86b|||Mundo real", "https://youtube.com", "", "unlocked"]);
    sheetNodos.appendRow(["N-002", "Frecuencia Emancipada", "Alma, Beto y Gera", "Repositorio de evidencias sonoras. La comunidad debe documentar una problemática educativa de su territorio en un audio de máximo 30 segundos.", "Podcast", "BASE|||#65d6b0|||Mundo auditivo", "https://spotify.com", "2", "locked"]);
    sheetNodos.appendRow(["N-003", "Pedagogía crítica virtual", "Alma, Beto y Gera", "El tercer umbral se abre cuando la red recibe 2 audios. Desde aquí la comunidad puede aportar elementos y liberar progresivamente la creación de nuevos nodos y subnodos.", "Artículo", "BASE|||#a78bfa|||Mundo posible", "https://medium.com", "", "locked"]);
  }
  
  if (!sheetAportes) {
    sheetAportes = ss.insertSheet("Aportes");
    sheetAportes.appendRow(["idAporte", "idNodo", "tipo", "autor", "ubicacion", "texto", "url", "fecha"]);
  }
  
  if (!sheetConexiones) {
    sheetConexiones = ss.insertSheet("Conexiones");
    sheetConexiones.appendRow(["origen", "destino", "fecha"]);
  }
  inicializarConexionesNarrativas(sheetConexiones);
}

function inicializarConexionesNarrativas(sheet) {
  const existentes = sheet.getDataRange().getValues();
  [["N-001", "N-002"], ["N-002", "N-003"]].forEach(conexion => {
    const existe = existentes.slice(1).some(fila => String(fila[0]) === conexion[0] && String(fila[1]) === conexion[1]);
    if (!existe) sheet.appendRow([conexion[0], conexion[1], new Date()]);
  });

  const nodosSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Nodos");
  if (!nodosSheet) return;
  const nodos = nodosSheet.getDataRange().getValues();
  const bases = {};
  for (let i = 1; i < nodos.length; i++) {
    const partes = String(nodos[i][5] || "").split("|||");
    if (partes[0] === "BASE") bases[partes[2] || nodos[i][1]] = nodos[i][0];
  }
  for (let i = 1; i < nodos.length; i++) {
    const partes = String(nodos[i][5] || "").split("|||");
    const padre = partes[0] === "SUB" ? bases[partes[2]] : "";
    if (!padre) continue;
    const existe = existentes.slice(1).some(fila => String(fila[0]) === String(nodos[i][0]) && String(fila[1]) === String(padre));
    if (!existe) sheet.appendRow([nodos[i][0], padre, new Date()]);
  }
}
