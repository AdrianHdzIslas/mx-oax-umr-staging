const SINONIMOS = {
  "permiso obra":"construccion", "edificar":"construccion", "construir casa":"construccion",
  "construir":"construccion", "edificio":"construccion", "obra":"construccion",
  "impuesto casa":"predial", "pago predio":"predial", "casa":"predial",
  "negocio":"comercio", "local":"comercio", "tienda":"comercio", "abrir negocio":"funcionamiento",
  "terraza":"via publica", "mesa afuera":"via publica", "silla calle":"via publica", "restaurante calle":"via publica", "enseres":"via publica",
  "bar":"alcohol", "cantina":"alcohol", "cerveza":"alcohol",
  "auto":"vehiculo", "carro":"vehiculo", "coche":"vehiculo",
  "permiso":"licencia", "papel":"constancia", "tramite agua":"agua", "arbol":"poda"
};

function norm(s){
  return (s||"").toString().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g,"");
}

/* Expande la consulta con sinónimos (añade el término canónico) */
function expandir(qn){
  let extra=[];
  for(const [coloq,canon] of Object.entries(SINONIMOS)){
    if(qn.includes(norm(coloq))) extra.push(norm(canon));
  }
  return extra;
}

/* ============================================================
   ÍNDICE DE BÚSQUEDA
   Pre-construimos un blob normalizado por trámite con pesos.
   ============================================================ */
let DATA = [];
function indexarTramite(t, enLinea){
  return {
    ref: t,
    n_nombre: norm((t.nombre_display||t.nombre) + " " + t.nombre),
    n_dep: norm(t.dependencia),
    n_cat: norm((t.categoria||"") + " " + (t.categoria_ciudadana||"")),
    n_obj: norm((t.objetivo||"") + " " + (t.casos||"") + " " + (t.resultado||"")),
    n_tags: norm((t.etiquetas||[]).join(" ")),
    n_clave: norm(t.clave)
  };
}
function construirIndice(){
  DATA = window.TRAMITES.map(t=>indexarTramite(t,false))
    .concat((window.TRAMITES_EN_LINEA||[]).map(t=>indexarTramite(t,true)));
}

/* Puntúa un trámite contra los términos de búsqueda */
function puntuar(item, terms, extras){
  let score=0;
  const allTerms = terms.concat(extras);
  for(const w of terms){
    if(!w) continue;
    if(item.n_nombre.includes(w)) score+=10;
    if(item.n_clave.includes(w)) score+=8;
    if(item.n_tags.includes(w)) score+=6;
    if(item.n_cat.includes(w)) score+=4;
    if(item.n_dep.includes(w)) score+=3;
    if(item.n_obj.includes(w)) score+=2;
  }
  for(const w of extras){
    if(!w) continue;
    if(item.n_nombre.includes(w)) score+=5;
    if(item.n_tags.includes(w)) score+=4;
    if(item.n_obj.includes(w)) score+=2;
  }
  return score;
}

/* ============================================================
   ESTADO DE FILTROS
   ============================================================ */
const estado = {q:"", dep:"", tipo:"", costo:"", tiempo:"", catCiud:"", modalidad:""};

function pasaFiltros(t){
  if(estado.dep && t.ref.dependencia!==estado.dep) return false;
  if(estado.tipo && (t.ref.tipo||"Trámite")!==estado.tipo) return false;
  if(estado.modalidad==="en_linea" && !t.ref.en_linea) return false;
  if(estado.modalidad==="presencial" && t.ref.en_linea) return false;
  if(estado.catCiud && t.ref.categoria_ciudadana_id!==estado.catCiud) return false;
  // Costo
  if(estado.costo){
    const c=t.ref.costo_uma, tipo=t.ref.costo_tipo;
    if(estado.costo==="gratuito" && tipo!=="gratuito") return false;
    if(estado.costo==="hasta5" && !(tipo==="uma" && c!=null && c<=5)) return false;
    if(estado.costo==="mas5" && !(tipo==="uma" && c!=null && c>5)) return false;
  }
  
  if(estado.tiempo){
    const d=t.ref.tiempo_dias;
    if(estado.tiempo==="inmediato" && !(d===0)) return false;
    if(estado.tiempo==="hasta5" && !(d!=null && d>0 && d<=5)) return false;
    if(estado.tiempo==="mas5" && !(d!=null && d>5)) return false;
  }
  return true;
}

function buscar(){
  const qn = norm(estado.q).trim();
  const terms = qn.split(/\s+/).filter(Boolean);
  const extras = qn ? expandir(qn) : [];
  let res;
  if(terms.length===0){
    
    res = DATA.filter(pasaFiltros).map(it=>({it,score:0}));
    res.sort((a,b)=>a.it.ref.nombre_display.localeCompare(b.it.ref.nombre_display,'es'));
  }else{
    res = DATA.filter(pasaFiltros)
      .map(it=>({it,score:puntuar(it,terms,extras)}))
      .filter(r=>r.score>0)
      .sort((a,b)=>b.score-a.score);
  }
  render(res.map(r=>r.it), terms.concat(extras));
}

function costoTxt(t){
  if(t.costo_tipo==="gratuito") return "Gratuito";
  if(t.costo_tipo==="uma" && t.costo_uma!=null) return t.costo_uma+" UMA";
  return "Consultar";
}
function tiempoTxt(t){
  if(t.tiempo_dias===0) return "Inmediato";
  if(t.tiempo_dias!=null) return t.tiempo_dias+" días";
  return t.tiempo || "Consultar";
}
function resaltar(txt, terms){
  if(!terms.length) return escapeHtml(txt);
  let out=escapeHtml(txt);
  const tn=norm(txt);
  
  for(const w of terms){
    if(w.length<3) continue;
    const i=tn.indexOf(w);
    if(i>=0){
      out = escapeHtml(txt.slice(0,i))+"<mark>"+escapeHtml(txt.slice(i,i+w.length))+"</mark>"+escapeHtml(txt.slice(i+w.length));
      break;
    }
  }
  return out;
}
function escapeHtml(s){return (s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}

const iconClock='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const iconCoin='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2 0 0 1 5 0c0 2.5-5 1.5-5 4a2.5 2 0 0 0 5 0"/></svg>';
const iconBldg='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></svg>';
const iconExternal='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/></svg>';
const iconInfo='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/></svg>';

function render(items, terms){
  const lista=document.getElementById('lista');
  document.getElementById('count').innerHTML =
    `<b>${items.length}</b> resultado${items.length===1?"":"s"}` +
    (estado.q?` para "${escapeHtml(estado.q)}"`:"");
  renderChips();

  if(items.length===0){ renderVacio(); return; }

  lista.innerHTML = items.slice(0,80).map(it=>{
    const t=it.ref;
    if(t.en_linea){
      return `<article class="card card-en-linea" onclick="abrirTramiteEnLinea('${t.url_inicio}')">
      <div class="card-top">
        <div>
          <h3>${resaltar(t.nombre_display,terms)}</h3>
          <div class="dep">${iconBldg} ${escapeHtml(t.dependencia)}</div>
        </div>
        <span class="badge en-linea">EN LÍNEA ${iconExternal}</span>
      </div>
      <div class="meta">
        <span class="m">${iconCoin} <b>${escapeHtml(t.costo)}</b></span>
        ${t.clave?`<span class="m clave">${escapeHtml(t.clave)}</span>`:""}
      </div>
      <div class="nota-en-linea">${iconInfo} Se inicia en el portal municipal, en una pestaña nueva</div>
    </article>`;
    }
    const badgeClass = t.tipo==="Trámite"?"tramite":(t.tipo==="Servicio"?"servicio":"formato");
    const tagsMatch = (t.etiquetas||[]).slice(0,5).map(tg=>{
      const m = terms.some(w=>w.length>2 && norm(tg).includes(w));
      return `<span class="tag ${m?'match':''}">${escapeHtml(tg)}</span>`;
    }).join("");
    return `<article class="card" onclick="abrirTramite('${t.slug}')">
      <div class="card-top">
        <div>
          <h3>${resaltar(t.nombre_display,terms)}</h3>
          <div class="dep">${iconBldg} ${escapeHtml(t.dependencia)}</div>
        </div>
        <span class="badge ${badgeClass}">${escapeHtml(t.tipo)}</span>
      </div>
      <div class="meta">
        <span class="m">${iconCoin} <b>${costoTxt(t)}</b></span>
        <span class="m">${iconClock} ${tiempoTxt(t)}</span>
      </div>
      ${tagsMatch?`<div class="tags">${tagsMatch}</div>`:""}
    </article>`;
  }).join("");
}

function abrirTramiteEnLinea(url){
  window.open(url,'_blank','noopener');
}

function renderVacio(){
  // Sugerencias: trámites más cercanos ignorando el filtro de costo/tiempo
  const qn=norm(estado.q);
  const terms=qn.split(/\s+/).filter(Boolean);
  const extras=expandir(qn);
  let cercanos = DATA.map(it=>({it,score:puntuar(it,terms,extras)}))
    .filter(r=>r.score>0).sort((a,b)=>b.score-a.score).slice(0,4);
  let sugHtml="";
  if(cercanos.length){
    sugHtml = `<p>¿Buscabas alguno de estos?</p><div class="sugerencias">` +
      cercanos.map(r=>{
        const t=r.it.ref;
        if(t.en_linea) return `<div class="sug-link" onclick="abrirTramiteEnLinea('${t.url_inicio}')">${escapeHtml(t.nombre)} <span style="color:var(--texto-sec);font-weight:400">· ${escapeHtml(t.dependencia)}</span></div>`;
        return `<div class="sug-link" onclick="abrirTramite('${t.slug}')">${escapeHtml(t.nombre_display)} <span style="color:var(--texto-sec);font-weight:400">· ${escapeHtml(t.dependencia)}</span></div>`;
      }).join("") +
      `</div>`;
  }else{
    sugHtml = `<div class="sugerencias">
      <div class="sug-link" onclick="setQuery('licencia construcción')">Licencia de construcción</div>
      <div class="sug-link" onclick="setQuery('predial')">Pago del predial</div>
      <div class="sug-link" onclick="setQuery('comercio')">Abrir un comercio</div>
    </div>`;
  }
  document.getElementById('lista').innerHTML =
    `<div class="empty"><h3>No encontramos trámites con esa búsqueda</h3>
     <p>Revisa la ortografía o intenta con palabras más generales.</p>${sugHtml}</div>`;
}

/* Chips de filtros activos */
function renderChips(){
  const map={dep:estado.dep,tipo:estado.tipo,
    modalidad:{en_linea:"En línea",presencial:"En ventanilla"}[estado.modalidad],
    costo:{gratuito:"Gratuito",hasta5:"Hasta 5 UMA",mas5:"Más de 5 UMA"}[estado.costo],
    tiempo:{inmediato:"Inmediato",hasta5:"Hasta 5 días",mas5:"Más de 5 días"}[estado.tiempo],
    catCiud: estado.catCiud ? (CATS.find(c=>c.id===estado.catCiud)||{}).label : ""};
  let html="";
  for(const [k,v] of Object.entries(map)){
    if(v) html+=`<span class="chip-activo">${escapeHtml(v)} <button onclick="quitarFiltro('${k}')">×</button></span>`;
  }
  document.getElementById('chips').innerHTML=html;
}
function quitarFiltro(k){
  estado[k]="";
  if(k==="dep") document.getElementById('f-dep').value="";
  if(k==="tipo") document.querySelector('input[name=tipo][value=""]').checked=true;
  if(k==="modalidad") document.querySelector('input[name=modalidad][value=""]').checked=true;
  if(k==="costo") document.querySelector('input[name=costo][value=""]').checked=true;
  if(k==="tiempo") document.querySelector('input[name=tiempo][value=""]').checked=true;
  if(k==="catCiud") renderCats();
  buscar();
}

/* ============================================================
   CATEGORÍAS CIUDADANAS (chips arriba)
   ============================================================ */
/* Metadatos de cada categoría ciudadana: color suave + ícono + descripción.
   Organiza por "momento de vida", no por dependencia. */
const CAT_META={
  'vivienda-construccion':{ic:'🏠',color:'#b5683a',bg:'#f7ece5',titulo:'Vivienda y Construcción',desc:'Permisos de obra, alineamiento, uso de suelo, número oficial.'},
  'comercio-negocio':{ic:'💼',color:'#5c6b00',bg:'#eef2d6',titulo:'Comercio y Negocio',desc:'Abrir un local, licencias de funcionamiento, mercados, anuncios.'},
  'transito-vehiculos':{ic:'🚗',color:'#3f6079',bg:'#e9eef2',titulo:'Tránsito, Movilidad y Protección Civil',desc:'Vialidad, vehículos, dictámenes de seguridad y riesgo.'},
  'medio-ambiente':{ic:'🌳',color:'#4a6b2f',bg:'#e9f0e5',titulo:'Medio Ambiente',desc:'Áreas verdes, poda y derribo de árboles, agua, denuncias.'},
  'justicia-conciliacion':{ic:'⚖️',color:'#5a3b7a',bg:'#efe9f3',titulo:'Justicia y Conciliación',desc:'Mediación, conciliación civil, mercantil y vecinal.'},
  'impuestos-predial':{ic:'💰',color:'#265b4d',bg:'#e9f0ec',titulo:'Impuestos y Predial',desc:'Predial, catastro, cuentas y registros fiscales.'},
  'tramites-generales':{ic:'📋',color:'#5c6772',bg:'#f0ece9',titulo:'Trámites Generales',desc:'Documentos, constancias, bienestar, cultura y deporte.'}
};
let CATS=[];
function construirCats(){
  const m={};
  window.TRAMITES.forEach(t=>{m[t.categoria_ciudadana_id]=(m[t.categoria_ciudadana_id]||{n:0,label:t.categoria_ciudadana});m[t.categoria_ciudadana_id].n++;});
  CATS=Object.entries(m).map(([id,o])=>({id,label:o.label,n:o.n})).sort((a,b)=>b.n-a.n);
}

/* Estado "home": sin texto y sin filtros activos */
function esHome(){
  return !estado.q.trim() && !estado.dep && !estado.tipo && !estado.costo && !estado.tiempo && !estado.catCiud && !estado.modalidad;
}
/* Grid de categorías ciudadanas como puerta de entrada */
function renderHomeGrid(){
  document.getElementById('count').innerHTML='Explora por tema o usa el buscador';
  document.getElementById('chips').innerHTML='';
  const cards=CATS.map(c=>{
    const meta=CAT_META[c.id]||{ic:'📄',color:'var(--oro)',bg:'var(--crema)',titulo:c.label,desc:''};
    return `<div class="cat-card" style="--cc:${meta.color};background:${meta.bg}" onclick="toggleCat('${c.id}')">
      <span class="ic">${meta.ic}</span>
      <h3>${escapeHtml(meta.titulo)}</h3>
      <p>${escapeHtml(meta.desc)}</p>
      <span class="n">${c.n} trámite${c.n===1?'':'s'} →</span>
    </div>`;
  }).join('');
  document.getElementById('lista').innerHTML=`<div class="home-intro">¿Qué necesitas resolver?</div><div class="cat-grid">${cards}</div>`;
}
function renderCats(){
  document.getElementById('cats').innerHTML = CATS.map(c=>
    `<div class="cat-chip ${estado.catCiud===c.id?'active':''}" onclick="toggleCat('${c.id}')">${escapeHtml(c.label)}<span class="n">${c.n}</span></div>`
  ).join("");
}
function toggleCat(id){
  estado.catCiud = (estado.catCiud===id?"":id);
  renderCats(); buscar();
}

/* ============================================================
   INTERACCIÓN BUSCADOR + AUTOCOMPLETADO
   ============================================================ */
let acIndex=-1, acItems=[];
function autocompletar(){
  const qn=norm(estado.q).trim();
  const ac=document.getElementById('ac');
  if(qn.length<2){ ac.style.display="none"; return; }
  const terms=qn.split(/\s+/).filter(Boolean);
  const extras=expandir(qn);
  acItems = DATA.map(it=>({it,score:puntuar(it,terms,extras)}))
    .filter(r=>r.score>0).sort((a,b)=>b.score-a.score).slice(0,6).map(r=>r.it);
  if(!acItems.length){ ac.style.display="none"; return; }
  acIndex=-1;
  ac.innerHTML=acItems.map((it,i)=>
    `<div class="ac-item" data-i="${i}" onclick="elegirAc(${i})">${resaltar(it.ref.nombre_display,terms.concat(extras))}<span class="ac-dep">${escapeHtml(it.ref.dependencia)} · ${costoTxt(it.ref)} · ${tiempoTxt(it.ref)}</span></div>`
  ).join("");
  ac.style.display="block";
}
function elegirAc(i){ abrirTramite(acItems[i].ref.slug); }

/* Navega a la página propia del trámite (Fase 2) vía ruta por hash.
   En producción Laravel esto es /tramite/{slug} con render del servidor. */
function abrirTramite(slug){
  document.getElementById('ac').style.display="none";
  location.hash = "t=" + slug;
}

function setQuery(v){
  estado.q=v; document.getElementById('q').value=v;
  document.getElementById('clear').style.display="flex";
  buscar(); autocompletar();
}

/* ============================================================
   FASE 2 — PÁGINA PROPIA POR TRÁMITE
   ============================================================ */

/* URL pública compartible/indexable (la que va en WhatsApp, QR y OG).
   En la demo navegamos por #t=slug, pero compartimos la URL de producción. */
function urlPublica(t){
  // Base dinámica: origen + ruta reales de donde está alojado el sitio en este
  // momento, así el enlace copiado, el QR y el botón de WhatsApp siempre apuntan
  // al servidor real (pruebas, producción, subcarpeta, etc.) y no a un dominio fijo.
  const base = location.origin + location.pathname; // ej. https://dominio.gob.mx/index.html
  return base + "#t=" + encodeURIComponent(t.slug);
}

/* Convierte texto corrido en lista: acepta "1.", "1.-", "1)" y, si no hay numeración, respeta los saltos de línea */
function fmtNumerada(txt){
  if(!txt || /^(no especificad|n\/a|no aplica|no disponible|-)\.?$/i.test(txt.trim()))
    return '<em style="color:var(--texto-sec)">No especificado en la ficha.</em>';
  const t=txt.replace(/\r/g,'\n').trim();
  const NUM=/(?:^|\s)(\d{1,2})[.)](?:-)?\s/;
  if(NUM.test(t)){
    const parts=t.split(/\s*(?=(?:^|\s)\d{1,2}[.)]-?\s)/).map(s=>s.trim()).filter(Boolean);
    const nums=parts.filter(x=>/^\d{1,2}[.)]-?\s/.test(x));
    if(nums.length>=2){
      const pre=parts.filter(x=>!/^\d{1,2}[.)]-?\s/.test(x)).map(x=>'<p>'+escapeHtml(x)+'</p>').join('');
      return pre+'<ol>'+nums.map(x=>'<li>'+escapeHtml(x.replace(/^\d{1,2}[.)]-?\s*/,'').trim())+'</li>').join('')+'</ol>';
    }
  }
  /* Un bloque que es dato de contacto, encabezado o salvedad no es un paso: no se numera */
  const noEsPaso=b=>/:$/.test(b)||/\d{1,2}:\d{2}/.test(b)||/hrs\.?$/i.test(b)||/^(horario|ubicaci[óo]n|direcci[óo]n|tel[eé]fono|correo)/i.test(b)||/C\.P\.|N°|N\.°/.test(b);
  const listaOParrafos=arr=>arr.some(noEsPaso)
    ? arr.map(b=>'<p>'+escapeHtml(b)+'</p>').join('')
    : '<ol>'+arr.map(b=>'<li>'+escapeHtml(b)+'</li>').join('')+'</ol>';
  const bloques=t.split(/\n\s*\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
  if(bloques.length>=2) return listaOParrafos(bloques);
  const lineas=t.split(/\n/).map(s=>s.trim()).filter(Boolean);
  if(lineas.length>=2) return listaOParrafos(lineas);
  return '<p>'+escapeHtml(t.replace(/\s+/g,' '))+'</p>';
}

/* Separa el procedimiento por canal de atención (en línea, presencial, telefónico) */
function fmtProcedimiento(txt){
  if(!txt || /^(no especificad|n\/a|no aplica|-)$/i.test(txt.trim()))
    return '<em style="color:var(--texto-sec)">No especificado en la ficha.</em>';
  const re=/(?:^|\n)\s*(En l[íi]nea|En linea|Presencial|Telef[óo]nico|Tel[eé]fono|En ventanilla|Ventanilla|Correo electr[óo]nico|En Departamento|Digital)\.?\s*:/gi;
  const marcas=[...txt.matchAll(re)];
  if(!marcas.length) return fmtNumerada(txt);
  const bloques=[];
  if(marcas[0].index>0){ const pre=txt.slice(0,marcas[0].index).trim(); if(pre) bloques.push({canal:null,cuerpo:pre}); }
  marcas.forEach((m,i)=>{
    const fin = i+1<marcas.length ? marcas[i+1].index : txt.length;
    let cuerpo = txt.slice(m.index+m[0].length, fin).trim();
    /* "No disponible" seguido de más texto: el canal no existe y lo que sigue es informativo */
    const nd = cuerpo.match(/^(no disponible|no aplicable|no aplica|ninguno|n\/a)\.?\s*([\s\S]*)$/i);
    if(nd && nd[2].trim()){
      bloques.push({canal:m[1], cuerpo:''});
      bloques.push({canal:null, cuerpo:nd[2].trim()});
      return;
    }
    bloques.push({canal:m[1], cuerpo:cuerpo});
  });
  return '<div class="canales">'+bloques.map(b=>{
    const vacio = !b.cuerpo || /^(no disponible|no aplicable|no aplica|ninguno|n\/a|-)\.?$/i.test(b.cuerpo.trim());
    if(!b.canal) return '<div class="canal"><div class="canal-cuerpo">'+fmtNumerada(b.cuerpo)+'</div></div>';
    return '<div class="canal'+(vacio?' canal-no':'')+'">'
      +'<div class="canal-h">'+escapeHtml(b.canal.replace(/\.+$/,''))+(vacio?'<span class="canal-tag">No disponible</span>':'')+'</div>'
      +(vacio?'':'<div class="canal-cuerpo">'+fmtNumerada(b.cuerpo)+'</div>')
      +'</div>';
  }).join('')+'</div>';
}

/* Extrae Artículo + fracción del fundamento del costo -> ancla a Ley de Ingresos */
function parseLey(fund){
  if(!fund) return null;
  const mArt = fund.match(/art[íi]culo\s+(\d+)/i);
  if(!mArt) return null;
  const mFr = fund.match(/fracci[óo]n\s+([IVXLCDM]+|\d+)/i);
  const art = mArt[1], fr = mFr ? mFr[1] : null;
  return {
    anchor: 'art'+art + (fr ? '-'+fr.toLowerCase() : ''),
    label: 'Artículo '+art + (fr ? ', fracción '+fr : '')
  };
}

/* Meta OG dinámico (en producción se renderiza en el servidor para que sea indexable) */
function setMetaOG(t){
  document.title = t.nombre_display + ' — Trámites UMR Oaxaca';
  const tags = {
    'og:title': t.nombre_display + ' - UMR Oaxaca',
    'og:description': (t.objetivo||'').slice(0,150),
    'og:url': urlPublica(t),
    'og:type': 'website'
  };
  for(const [p,c] of Object.entries(tags)){
    let el = document.querySelector('meta[property="'+p+'"]');
    if(!el){ el=document.createElement('meta'); el.setAttribute('property',p); document.head.appendChild(el); }
    el.setAttribute('content', c);
  }
}
function setMetaBase(){ document.title = 'Trámites y Servicios · Mejora Regulatoria · Oaxaca de Juárez'; }

const icoChevron='<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';

function renderDetalle(t){
  const cont=document.getElementById('vista-detalle');
  const badgeClass = t.tipo==='Trámite'?'tramite':(t.tipo==='Servicio'?'servicio':'formato');
  const ley = parseLey(t.fundamento_costo);
  const sensible = t.sensible;

  // Datos destacados
  const destacados = `<div class="destacados">
    <div class="dato"><div class="lbl">Costo</div><div class="val">${costoTxt(t)}</div></div>
    <div class="dato"><div class="lbl">Tiempo</div><div class="val">${tiempoTxt(t)}</div></div>
    <div class="dato"><div class="lbl">Vigencia</div><div class="val">${escapeHtml(t.vigencia||'—')}</div></div>
    <div class="dato"><div class="lbl">Tipo</div><div class="val">${escapeHtml(t.tipo)}</div></div>
  </div>`;

  // Compartir (oculto en sensibles)
  const compartir = sensible
    ? `<div class="aviso-sensible">🔒 Este registro contiene datos sensibles. No se genera URL pública, QR ni vista para compartir.</div>`
    : `<div class="compartir">
        <button class="btn-share primario" onclick="copiarEnlace('${escapeHtml(urlPublica(t))}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>
          Copiar enlace
        </button>
        <button class="btn-share" onclick="abrirQR('${t.slug}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M20 14v.01M14 20h.01M17 20h.01M20 17v3"/></svg>
          Código QR
        </button>
        <button class="btn-share" onclick="window.print()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimir / PDF
        </button>
      </div>`;

  // Acordeones
  function acc(titulo, contenidoHtml, abierto){
    return `<div class="acc${abierto?' open':''}">
      <div class="acc-head" onclick="this.parentNode.classList.toggle('open')">${escapeHtml(titulo)} ${icoChevron}</div>
      <div class="acc-body">${contenidoHtml}</div>
    </div>`;
  }
  const queEs = `<div class="campo"><b>Objetivo</b>${fmtNumerada(t.objetivo)}</div>`+
                `<div class="campo"><b>¿En qué casos debe realizarse?</b>${fmtNumerada(t.casos)}</div>`;
  const cuesta = `<div class="campo"><b>Costo</b><p>${escapeHtml(t.costo||'—')}</p></div>`+
    `<div class="campo"><b>Fundamento del costo</b><p>${escapeHtml(t.fundamento_costo||'—')}</p></div>`+
    (ley ? `<a class="ley-link" onclick="irLey('${ley.anchor}','${escapeHtml(ley.label)}')">📖 Ver fundamento en la Ley de Ingresos 2026: ${escapeHtml(ley.label)} →</a>` : '');
  const marco = `<div class="campo"><b>Fundamento legal</b>${fmtNumerada(t.fundamento_legal)}</div>`+
    `<div class="campo"><b>Medios de impugnación</b>${fmtNumerada(t.medios_impugnacion)}</div>`;
  const mapaQ = encodeURIComponent((t.domicilio||'')+' Oaxaca de Juárez, Oaxaca, México');
  const donde = `<div class="contacto-grid">`+
    `<div class="campo"><b>Área responsable</b><p>${escapeHtml(t.area||'—')}</p></div>`+
    `<div class="campo"><b>Departamento</b><p>${escapeHtml(t.departamento||'—')}</p></div>`+
    `<div class="campo"><b>Domicilio</b><p>${escapeHtml(t.domicilio||'—')}</p></div>`+
    `<div class="campo"><b>Teléfono</b><p>${escapeHtml(t.telefono||'—')}</p></div>`+
    `<div class="campo"><b>Horario</b><p>${escapeHtml(t.horario||'—')}</p></div>`+
    `<div class="campo"><b>Página web</b><p>${escapeHtml(t.pagina_web||'—')}</p></div>`+
    `</div>`+
    (t.domicilio ? `<iframe class="mapa" loading="lazy" src="https://www.google.com/maps?q=${mapaQ}&output=embed"></iframe>` : '');

  cont.innerHTML = `<div class="detalle-wrap">
    <nav class="breadcrumb"><a onclick="irBusqueda()">Inicio</a><span>›</span><a onclick="filtrarDep('${escapeHtml(t.dependencia)}')">${escapeHtml(t.dependencia)}</a><span>›</span>${escapeHtml(t.nombre_display)}</nav>
    <header class="det-head">
      <span class="badge ${badgeClass}">${escapeHtml(t.tipo)}</span>
      <h1>${escapeHtml(t.nombre_display)}</h1>
      <div class="dep">Clave: <b style="color:var(--borgona)">${escapeHtml(t.clave)}</b></div>
    </header>
    ${destacados}
    ${compartir}
    ${acc('¿Qué es este trámite?', queEs, true)}
    ${acc('¿Qué necesito?', fmtNumerada(t.requisitos), false)}
    ${acc('¿Cómo lo hago?', fmtProcedimiento(t.procedimiento), false)}
    ${acc('¿Qué recibo?', fmtNumerada(t.resultado), false)}
    ${acc('¿Cuánto cuesta?', cuesta, false)}
    ${acc('Marco legal', marco, false)}
    ${acc('¿Dónde acudo?', donde, false)}
    <div class="det-volver"><button class="btn-reset" style="width:auto;padding:10px 20px" onclick="irBusqueda()">← Volver a la búsqueda</button></div>
  </div>`;

  if(!sensible) setMetaOG(t); else setMetaBase();
}

/* Navegación a la vista de búsqueda con estado preseteado */
function irBusqueda(){ location.hash='buscar'; }
function irBusquedaCat(id){ estado.catCiud=id; location.hash='buscar'; }
function irBusquedaDep(dep){ estado.dep=dep; location.hash='buscar'; }
function filtrarDep(dep){ estado.dep=dep; location.hash='buscar'; }
function setQueryGo(q){ estado.q=q; location.hash='buscar'; }
/* Lleva a la sección Costos 2026 del portal (misma pestaña, dentro del shell).
   No se abre en pestaña nueva ni se apunta directo al archivo embebido porque
   ese archivo tiene su encabezado principal quitado (para no duplicarlo
   dentro del iframe del SPA) y se vería huérfano si se abriera solo. */
function irLey(anchor,label){
  location.hash='costos';
}

/* Sincroniza los controles de la vista de búsqueda con el estado y ejecuta */
function syncRadio(name,val){const r=document.querySelector('input[name='+name+'][value="'+(val||'')+'"]');if(r)r.checked=true;}
function abrirBusqueda(){
  const q=document.getElementById('q'); if(q){q.value=estado.q;document.getElementById('clear').style.display=estado.q?'flex':'none';}
  const fd=document.getElementById('f-dep'); if(fd)fd.value=estado.dep||'';
  syncRadio('tipo',estado.tipo);syncRadio('costo',estado.costo);syncRadio('tiempo',estado.tiempo);syncRadio('modalidad',estado.modalidad);
  renderCats(); buscar();
}

function copiarEnlace(url){
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(()=>mostrarToast('Enlace copiado'),()=>fallbackCopia(url));
  } else fallbackCopia(url);
}
function fallbackCopia(url){
  const ta=document.createElement('textarea');ta.value=url;document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');mostrarToast('Enlace copiado');}catch(e){mostrarToast('Copia manual: '+url);}
  document.body.removeChild(ta);
}
function mostrarToast(msg){
  let el=document.getElementById('toast');
  if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.appendChild(el);}
  el.textContent=msg;el.classList.add('show');
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2600);
}

/* QR con servicio de imagen (producción: librería JS local o backend). */
function abrirQR(slug){
  const t=window.TRAMITES.find(x=>x.slug===slug); if(!t) return;
  const url=urlPublica(t);
  const src='https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=10&data='+encodeURIComponent(url);
  document.getElementById('qr-title').textContent=t.nombre_display;
  document.getElementById('qr-img').innerHTML='<img src="'+src+'" alt="QR del trámite">';
  const dl=document.getElementById('qr-dl'); dl.href=src; dl.download='qr-'+t.slug+'.png';
  document.getElementById('qr-modal').style.display='flex';
}
function cerrarQR(){ document.getElementById('qr-modal').style.display='none'; }

/* ============================================================
   FASE 4 — BLOG DE GUÍAS
   ============================================================ */
let GUIAS = [];          // se resuelve en init() porque los datos se inyectan al final del body
const utilVotos = {};   // contador en memoria de "¿te fue útil?"

function fmtFecha(iso){
  const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const d=new Date(iso+'T00:00:00'); return d.getDate()+' de '+meses[d.getMonth()]+' de '+d.getFullYear();
}

function renderBlog(){
  const cont=document.getElementById('vista-detalle');
  const cards=GUIAS.map(g=>{
    const meta=CAT_META[g.categoria_id]||{ic:'📄'};
    return `<article class="guia-card" onclick="location.hash='guia=${g.slug}'">
      <div class="thumb">${meta.ic}</div>
      <div class="body">
        <span class="badge">${escapeHtml(g.categoria)}</span>
        <h3>${escapeHtml(g.titulo)}</h3>
        <div class="fecha">${fmtFecha(g.fecha)}</div>
        <p class="exc">${escapeHtml(g.excerpt)}</p>
      </div>
    </article>`;
  }).join('');
  cont.innerHTML=`<div class="blog-wrap">
    <div class="blog-head"><h1>Guías y recomendaciones</h1><p>Artículos prácticos para resolver los trámites más frecuentes, paso a paso.</p></div>
    <div class="blog-grid">${cards}</div>
  </div>`;
  document.title='Guías · Trámites UMR Oaxaca';
}

function renderGuia(g){
  const cont=document.getElementById('vista-detalle');
  // Trámites relacionados (cards a su página propia)
  const rel=(g.relacionados||[]).map(cl=>window.TRAMITES.find(t=>t.clave===cl)).filter(Boolean);
  const relHtml=rel.map(t=>`<div class="rel-card" onclick="location.hash='t=${t.slug}'">
      <div class="rt">${escapeHtml(t.nombre_display)}</div>
      <div class="rm">${escapeHtml(t.dependencia)} · ${costoTxt(t)} · ${tiempoTxt(t)}</div></div>`).join('');
  // Sidebar: otras guías + categorías
  const otras=GUIAS.filter(x=>x.slug!==g.slug).map(x=>`<a class="lk" onclick="location.hash='guia=${x.slug}'">${escapeHtml(x.titulo)}</a>`).join('');
  const cats=CATS.map(c=>{const m=CAT_META[c.id]||{titulo:c.label};return `<a class="lk" onclick="toggleCatDesde('${c.id}')">${m.ic||''} ${escapeHtml(m.titulo||c.label)} <span style="color:var(--texto-sec)">(${c.n})</span></a>`;}).join('');
  const v=utilVotos[g.slug]||{si:0,no:0};

  cont.innerHTML=`<div class="blog-wrap">
    <nav class="breadcrumb"><a onclick="irBusqueda()">Inicio</a><span>›</span><a onclick="location.hash='blog'">Guías</a><span>›</span>${escapeHtml(g.titulo)}</nav>
    <div class="articulo-layout">
      <article class="articulo">
        <span class="badge" onclick="toggleCatDesde('${g.categoria_id}')">${escapeHtml(g.categoria)}</span>
        <h1>${escapeHtml(g.titulo)}</h1>
        <div class="meta-art">📅 ${fmtFecha(g.fecha)} · Unidad de Mejora Regulatoria</div>
        <div class="cuerpo">${g.contenido}</div>
        <div class="utilbox" id="util-${g.slug}">
          <b>¿Te fue útil esta guía?</b>
          <button onclick="votarUtil('${g.slug}',true)">👍 Sí (${v.si})</button>
          <button onclick="votarUtil('${g.slug}',false)">👎 No (${v.no})</button>
        </div>
        ${rel.length?`<div class="rel-tramites"><h3>Trámites de esta guía</h3>${relHtml}</div>`:''}
        <div class="det-volver"><button class="btn-reset" style="width:auto;padding:10px 20px" onclick="location.hash='blog'">← Volver a las guías</button></div>
      </article>
      <aside class="sidebar">
        <div class="box"><h3>Otras guías</h3>${otras||'<p style=\"font-size:13px;color:var(--texto-sec)\">Pronto más.</p>'}</div>
        <div class="box"><h3>Categorías</h3>${cats}</div>
      </aside>
    </div>
  </div>`;

  // SEO: meta description + schema.org Article (JSON-LD)
  document.title=g.titulo+' — Guías UMR Oaxaca';
  let md=document.querySelector('meta[name="description"]');
  if(!md){md=document.createElement('meta');md.name='description';document.head.appendChild(md);}
  md.content=g.meta||g.excerpt;
  let ld=document.getElementById('ld-art'); if(ld) ld.remove();
  ld=document.createElement('script'); ld.type='application/ld+json'; ld.id='ld-art';
  ld.textContent=JSON.stringify({"@context":"https://schema.org","@type":"Article","headline":g.titulo,
    "datePublished":g.fecha,"author":{"@type":"GovernmentOrganization","name":"Unidad de Mejora Regulatoria · Municipio de Oaxaca de Juárez"},
    "description":g.meta||g.excerpt,"url":"https://mejoraregulatoria.municipiodeoaxaca.gob.mx/guias/"+g.slug});
  document.head.appendChild(ld);
}
function votarUtil(slug,si){
  utilVotos[slug]=utilVotos[slug]||{si:0,no:0};
  utilVotos[slug][si?'si':'no']++;
  const v=utilVotos[slug];
  document.getElementById('util-'+slug).innerHTML=`<b>¡Gracias por tu opinión!</b>
    <button onclick="votarUtil('${slug}',true)">👍 Sí (${v.si})</button>
    <button onclick="votarUtil('${slug}',false)">👎 No (${v.no})</button>`;
}
function toggleCatDesde(id){ estado.catCiud=id; location.hash='buscar'; }

/* ============================================================
   FASE 5 — RUTAS DE TRÁMITES (multi-dependencia, estáticas)
   ============================================================ */
let RUTAS = [];   // se resuelve en init()

/* Agregados de una ruta a partir de los trámites reales */
function agregadosRuta(r){
  let nodos=0, uma=0, umaUnk=0, dias=0, diasUnk=0;
  r.etapas.forEach(e=>e.nodos.forEach(n=>{
    nodos++;
    const t=window.TRAMITES.find(x=>x.clave===n.clave); if(!t) return;
    if(t.costo_tipo==='gratuito'){} else if(t.costo_uma!=null){uma+=t.costo_uma;} else {umaUnk++;}
    if(t.tiempo_dias!=null){dias+=t.tiempo_dias;} else {diasUnk++;}
  }));
  return {nodos,uma,umaUnk,dias,diasUnk};
}
function fmtUMA(uma,unk){ const v=Math.round(uma*10)/10; if(!v&&unk) return 'por confirmar en caja'; return (unk?'desde ':'')+v+' UMA'+(unk?' (+'+unk+' por confirmar)':''); }

function renderRutas(){
  const cont=document.getElementById('vista-detalle');
  const cards=RUTAS.map(r=>{
    const a=agregadosRuta(r);
    return `<article class="ruta-card" onclick="location.hash='ruta=${r.slug}'">
      <span class="ic">${r.icono||'🧭'}</span>
      <h3>${escapeHtml(r.titulo)}</h3>
      <p>${escapeHtml(r.descripcion)}</p>
      <div class="stat"><b>${a.nodos}</b> trámites · <b>~${a.dias}</b> días · <b>${fmtUMA(a.uma,a.umaUnk)}</b></div>
    </article>`;
  }).join('');
  cont.innerHTML=`<div class="rutas-wrap">
    <div class="blog-head"><h1>Rutas de trámites</h1><p>Para proyectos grandes que cruzan varias dependencias: la secuencia completa, paso a paso, con costo y tiempo estimados.</p></div>
    <div class="ruta-grid">${cards}</div>
  </div>`;
  document.title='Rutas de trámites · UMR Oaxaca';
}

function renderRuta(r){
  const cont=document.getElementById('vista-detalle');
  const a=agregadosRuta(r);
  const etapas=r.etapas.map(e=>{
    const nodos=e.nodos.map(n=>{
      const t=window.TRAMITES.find(x=>x.clave===n.clave);
      if(!t) return '';
      const obj=(t.objetivo||'').slice(0,90);
      return `<div class="nodo" onclick="location.hash='t=${t.slug}'" title="${escapeHtml(t.objetivo||'')}">
        <div class="nt">${escapeHtml(t.nombre_display)}</div>
        <div class="nd">${escapeHtml(t.dependencia)}${obj?' · '+escapeHtml(obj)+'…':''}</div>
        <div class="nmeta"><span>💰 <b>${costoTxt(t)}</b></span><span>⏱ ${tiempoTxt(t)}</span><span class="estado ${n.estado}">${({previo:'Requisito previo',paralelo:'En paralelo',siguiente:'Siguiente paso'})[n.estado]||n.estado}</span></div>
      </div>`;
    }).join('');
    return `<div class="etapa"><div class="etapa-tit">${escapeHtml(e.titulo)}</div>${nodos}</div>`;
  }).join('');

  const avisos=(r.advertencias||[]).map(av=>{
    const cls=av.tipo==='warn'?'warn':'info';
    const ic=av.tipo==='warn'?'⚠️':(av.tipo==='pin'?'📌':'ℹ️');
    return `<div class="callout ${cls}">${ic} ${escapeHtml(av.texto)}</div>`;
  }).join('');
  const marco=(r.marco_normativo||[]).map(m=>`<li>${escapeHtml(m)}</li>`).join('');

  cont.innerHTML=`<div class="rutas-wrap">
    <nav class="breadcrumb"><a onclick="irBusqueda()">Inicio</a><span>›</span><a onclick="location.hash='rutas'">Rutas</a><span>›</span>${escapeHtml(r.titulo)}</nav>
    <div class="ruta-head">
      <h1>${r.icono||''} ${escapeHtml(r.titulo)}</h1>
      <p class="desc">${escapeHtml(r.descripcion)}</p>
      <div class="agregados">
        <div class="dato"><div class="lbl">Total de trámites</div><div class="val">${a.nodos}</div></div>
        <div class="dato"><div class="lbl">Tiempo estimado</div><div class="val">~${a.dias} días${a.diasUnk?' +':''}</div></div>
        <div class="dato"><div class="lbl">Costo estimado</div><div class="val">${fmtUMA(a.uma,a.umaUnk)}</div></div>
      </div>
      <div class="ruta-actions">
        ${r.infografia?`<button class="btn-share" onclick="window.open(\'${r.infografia}\',\'_blank\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="M7 12l5 5 5-5"/><path d="M5 21h14"/></svg> Descargar infografía (PDF)</button>`:''}
        <button class="btn-share" onclick="window.print()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Descargar guía completa (PDF)
        </button>
      </div>
    </div>
    <div class="avisos">${avisos}</div>
    <div class="timeline">${etapas}</div>
    ${marco?`<details class="marco-norm"><summary>📜 Marco legal de esta ruta</summary><ul>${marco}</ul></details>`:''}
    <div class="actualizado">Última actualización: ${escapeHtml(r.actualizado||'—')} · Las rutas son contenido editorial; se actualizan cuando cambia la normativa.</div>
    <div class="det-volver"><button class="btn-reset" style="width:auto;padding:10px 20px" onclick="location.hash='rutas'">← Volver a las rutas</button></div>
  </div>`;
  document.title=r.titulo+' — Rutas UMR Oaxaca';
}

/* ============================================================
   HOME (landing UMR Fresh) — datos reales
   ============================================================ */
/* Curaduría de "más consultados" (claves reales). En producción: ordenar por nº de consultas GA4. */
const POPULARES = ["SDE-T-IOEGBR","SM-T-CR","SOPyDU-T-DUSCIOCH","SOPyDU-DIRPUL-DPPU-DA","SOPyDU-T-LECVP","TM-T-TD","TM-T-CNACM","SOPyDU-T-NOF"];
const POPULARES_Q = ["Licencia de funcionamiento","Predial","Uso de suelo","Constancia de residencia"];

function renderHome(){
  const cont=document.getElementById('vista-home');
  
  const momentos=CATS.map(c=>{
    const m=CAT_META[c.id]||{ic:'📄',titulo:c.label,desc:'',color:'var(--oro)'};
    return `<div class="momento" style="--cc:${m.color}" onclick="irBusquedaCat('${c.id}')">
      <div class="ic">${m.ic}</div><div class="mt">${escapeHtml(m.titulo)}</div>
      <div class="md">${c.n} trámite${c.n===1?'':'s'}</div></div>`;
  }).join('');
  // Más consultados (curados)
  const pops=POPULARES.map(cl=>window.TRAMITES.find(t=>t.clave===cl)).filter(Boolean).map(t=>
    `<div class="pop-card" onclick="location.hash='t=${t.slug}'">
      <div style="display:flex;justify-content:space-between;align-items:center"><span class="badge ${t.costo_tipo==='gratuito'?'b-gratis':'b-pago'}" style="background:${t.costo_tipo==='gratuito'?'#e7f5ee':'#fbf3df'};color:${t.costo_tipo==='gratuito'?'#178a48':'#5c6b00'};font-weight:700;font-size:12px;padding:4px 10px;border-radius:999px">${costoTxt(t)}</span></div>
      <h3>${escapeHtml(t.nombre_display)}</h3>
      <div class="dep">🏛️ ${escapeHtml(t.dependencia)}</div>
    </div>`).join('');
  const popQ=POPULARES_Q.map(x=>`<a onclick="setQueryGo('${x}')">${escapeHtml(x)}</a>`).join('');

  cont.innerHTML=`
  <section class="home-hero">
    <div class="eyebrow">Portal de trámites del Municipio</div>
    <h1>Haz tus trámites sin vueltas ni sorpresas</h1>
    <p class="lead">Encuentra requisitos, costos y tiempos de respuesta en una sola pantalla. Sin descargar PDFs.</p>
    <div class="search-wrap">
      <div class="search-box">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#265b4d" stroke-width="2" style="margin-left:8px"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
        <input id="qh" type="text" autocomplete="off" placeholder="¿Qué trámite necesitas?">
        <button class="btn-buscar" onclick="setQueryGo(document.getElementById('qh').value)">Buscar</button>
      </div>
    </div>
    <div class="populares-q"><span>Populares:</span>${popQ}</div>
  </section>
  <div class="home-sec">
    <div class="momentos">${momentos}</div>
    <div class="momentos-note">Explora por <strong>momentos de vida</strong> — sin necesidad de saber qué dependencia lo atiende.</div>
    <section class="home-block">
      <div class="head">
        <div><div class="eyebrow">Lo que más busca la gente</div><h2>Trámites más consultados</h2></div>
        <button class="dep-cta-mini btn-out" style="background:#fff;color:var(--borgona);border:1.5px solid var(--borgona);border-radius:8px;padding:9px 15px;font-family:Montserrat;font-weight:700;font-size:13.5px;cursor:pointer" onclick="irBusqueda()">Ver todos →</button>
      </div>
      <div class="pop-grid">${pops}</div>
    </section>
    <section style="padding-bottom:30px">
      <div class="dep-cta">
        <div><h3>¿Prefieres buscar por dependencia?</h3><p>Explora los ${(window.TRAMITES||[]).length} trámites organizados por dependencia del municipio.</p></div>
        <button class="btn-out" onclick="irBusqueda()">Buscar por dependencia →</button>
      </div>
    </section>
  </div>`;
  // Permite Enter en el buscador del home
  const qh=document.getElementById('qh');
  if(qh) qh.addEventListener('keydown',e=>{if(e.key==='Enter')setQueryGo(qh.value);});
  setMetaBase();
}

/* ============================================================
   INSPECTORES — directorio público (padrón real, modo roster)
   Datos personales: nombre, dependencia, unidad, puesto (+ foto si existe).
   Sin folio/vigencia: es una lista de personas acreditadas, no verificación por folio.
   ============================================================ */
let INSPECTORES = [];
function avatar(i,cls){ return i.foto ? `<div class="${cls}"><img src="${escapeHtml(i.foto)}" alt="${escapeHtml(i.nombre)}"></div>` : `<div class="${cls}">${escapeHtml(i.iniciales)}</div>`; }

function renderInspectores(filtro){
  const cont=document.getElementById('vista-detalle');
  const f=norm(filtro||'');
  const lista=INSPECTORES.filter(i=>!f || norm(i.nombre+' '+i.dependencia+' '+i.unidad+' '+i.puesto).includes(f));
  const cards=lista.map(i=>`<div class="insp-card" onclick="location.hash='inspector=${i.id}'">
    ${avatar(i,'insp-foto')}
    <div style="flex:1"><div class="nm">${escapeHtml(i.nombre)}</div><div class="ar">${escapeHtml(i.puesto)} · ${escapeHtml(i.dependencia)}</div></div>
  </div>`).join('') || '<p class="muted" style="padding:20px;color:var(--texto-sec)">Sin coincidencias.</p>';

  cont.innerHTML=`<div class="insp-wrap">
    <nav class="breadcrumb"><a onclick="location.hash=''">Inicio</a><span>›</span>Inspectores acreditados</nav>
    <div class="insp-hero">
      <h1>Inspectores municipales acreditados</h1>
      <p>¿Un inspector te visitó? Confirma aquí que forma parte del padrón acreditado del Municipio. Busca por nombre, dependencia o puesto. <strong>Los pagos se realizan únicamente en las cajas del Municipio, con recibo oficial.</strong> Para cualquier aclaración, acude a la dependencia correspondiente: consulta el <a href="https://municipiodeoaxaca.gob.mx/directorio" target="_blank" rel="noopener">directorio de dependencias municipales</a>.</p>
      <div class="insp-aviso-priv">🔒 Directorio con datos personales, tratados conforme al <a href="https://transparencia.municipiodeoaxaca.gob.mx/aviso-de-privacidad" target="_blank" rel="noopener">Aviso de Privacidad del Municipio</a>. En producción: no indexable por buscadores.</div>
    </div>
    <div class="insp-search">
      <input id="insp-q" type="text" placeholder="Nombre, dependencia o puesto" value="${escapeHtml(filtro||'')}" oninput="renderInspectores(this.value)">
      <span style="align-self:center;font-size:13px;color:var(--texto-sec)">${lista.length} de ${INSPECTORES.length}</span>
    </div>
    <div class="insp-grid">${cards}</div>
  </div>`;
  const qi=document.getElementById('insp-q'); if(qi && filtro){ qi.focus(); qi.setSelectionRange(qi.value.length,qi.value.length); }
  document.title='Inspectores acreditados · UMR Oaxaca';
}
function renderInspector(i){
  const cont=document.getElementById('vista-detalle');
  cont.innerHTML=`<div class="insp-wrap">
    <nav class="breadcrumb"><a onclick="location.hash=''">Inicio</a><span>›</span><a onclick="location.hash='inspectores'">Inspectores</a><span>›</span>${escapeHtml(i.nombre)}</nav>
    <div class="insp-ficha">
      <div class="top">
        ${avatar(i,'foto-lg')}
        <h2>${escapeHtml(i.nombre)}</h2>
        <div style="margin-top:8px"><span class="insp-estatus vig" style="background:#fff">Acreditado</span></div>
      </div>
      <div class="body">
        <div class="row"><span class="k">Puesto</span><span class="v">${escapeHtml(i.puesto)}</span></div>
        <div class="row"><span class="k">Dependencia</span><span class="v">${escapeHtml(i.dependencia)}</span></div>
        <div class="row"><span class="k">Unidad / Área</span><span class="v">${escapeHtml(i.unidad||'—')}</span></div>
      </div>
    </div>
    <div class="insp-aviso-priv" style="max-width:520px;margin:14px auto 0">Si un inspector no aparece en el padrón o sus datos no coinciden, acude a la dependencia correspondiente. Consulta a quién dirigirte en el <a href="https://municipiodeoaxaca.gob.mx/directorio" target="_blank" rel="noopener">directorio de dependencias municipales</a>. Este directorio reproduce el padrón acreditado; no constituye credencial oficial.</div>
    <div class="det-volver" style="text-align:center"><button class="btn-reset" style="width:auto;padding:10px 20px" onclick="location.hash='inspectores'">← Volver al directorio</button></div>
  </div>`;
  document.title=i.nombre+' · Inspector acreditado';
}

/* ============================================================
   INSPECCIONES — catálogo de tipos de inspección/verificación (66)
   ============================================================ */
let INSPECCIONES = [];
function renderInspecciones(filtro){
  const cont=document.getElementById('vista-detalle');
  const f=norm(filtro||'');
  const lista=INSPECCIONES.filter(x=>!f || norm(x.nombre+' '+x.dependencia+' '+x.categoria+' '+x.area+' '+x.clave).includes(f));
  const cards=lista.map(x=>`<div class="inspc-card" onclick="location.hash='inspeccion=${x.slug}'">
    ${x.categoria?`<span class="cat">${escapeHtml(x.categoria)}</span>`:''}
    <h3>${escapeHtml(x.nombre)}</h3>
    <div class="dep">🏛️ ${escapeHtml(x.dependencia)}</div>
    <div class="clave">${escapeHtml(x.clave)}</div>
  </div>`).join('') || '<p class="muted" style="padding:20px;color:var(--texto-sec)">Sin coincidencias.</p>';

  cont.innerHTML=`<div class="insp-wrap">
    <nav class="breadcrumb"><a onclick="location.hash=''">Inicio</a><span>›</span>Inspecciones</nav>
    <div class="insp-hero" style="border-left-color:var(--oro)">
      <h1>Inspecciones y verificaciones municipales</h1>
      <p>Catálogo de las inspecciones y verificaciones que realizan las dependencias del Municipio: qué revisan, con qué objetivo y bajo qué área responsable.</p>
    </div>
    <div class="insp-search">
      <input id="inspc-q" type="text" placeholder="Busca: sanitaria, obra, vía pública, comercio…" value="${escapeHtml(filtro||'')}" oninput="renderInspecciones(this.value)">
      <span style="align-self:center;font-size:13px;color:var(--texto-sec)">${lista.length} de ${INSPECCIONES.length}</span>
    </div>
    <div class="inspc-grid">${cards}</div>
  </div>`;
  const qi=document.getElementById('inspc-q'); if(qi && filtro){ qi.focus(); qi.setSelectionRange(qi.value.length,qi.value.length); }
  document.title='Inspecciones · UMR Oaxaca';
}
function renderInspeccion(x){
  const cont=document.getElementById('vista-detalle');
  cont.innerHTML=`<div class="detalle-wrap">
    <nav class="breadcrumb"><a onclick="location.hash=''">Inicio</a><span>›</span><a onclick="location.hash='inspecciones'">Inspecciones</a><span>›</span>${escapeHtml(x.nombre)}</nav>
    <header class="det-head">
      <span class="badge tramite">Inspección</span>
      <h1>${escapeHtml(x.nombre)}</h1>
      <div class="dep">${iconBldg} ${escapeHtml(x.dependencia)} · Clave: <b style="color:var(--borgona)">${escapeHtml(x.clave)}</b></div>
    </header>
    ${acc2('Categoría', `<p>${escapeHtml(x.categoria||'—')}</p>`, true)}
    ${acc2('Objetivo', `<p>${escapeHtml(x.objetivo||'No especificado en la ficha.')}</p>`, true)}
    ${acc2('Área responsable', `<p>${escapeHtml(x.area||'—')}</p>`, false)}
    <div class="det-volver"><button class="btn-reset" style="width:auto;padding:10px 20px" onclick="location.hash='inspecciones'">← Volver a inspecciones</button></div>
  </div>`;
  document.title=x.nombre+' · Inspecciones UMR';
}
function acc2(t,html,open){ return `<div class="acc${open?' open':''}"><div class="acc-head" onclick="this.parentNode.classList.toggle('open')">${escapeHtml(t)} ${icoChevron}</div><div class="acc-body">${html}</div></div>`; }

function setActiveNav(view){
  document.querySelectorAll('#topnav button').forEach(b=>b.classList.toggle('on', b.dataset.nav===view));
  closeNav(); 
}

function toggleNav(){
  const open = !document.getElementById('topnav').classList.contains('open');
  document.getElementById('topnav').classList.toggle('open', open);
  document.getElementById('navToggle').classList.toggle('open', open);
  document.getElementById('navToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
  document.getElementById('navBackdrop').classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
}
function closeNav(){
  document.getElementById('topnav').classList.remove('open');
  document.getElementById('navToggle').classList.remove('open');
  document.getElementById('navToggle').setAttribute('aria-expanded', 'false');
  document.getElementById('navBackdrop').classList.remove('open');
  document.body.style.overflow = '';
}
/* Autoajusta la altura del iframe a la altura real de su contenido, para que
   la página crezca de forma natural (un solo scroll) en vez de quedar un
   recuadro de altura fija con scroll anidado — el recuadro fijo es lo que
   hacía ver como si faltara contenido, sobre todo en móvil.
   Bajo file:// cada documento tiene un origen opaco distinto, así que Chrome
   bloquea el acceso directo al DOM del iframe aunque estén en la misma
   carpeta; por eso el ajuste se hace por postMessage (funciona igual en
   file:// y en un servidor real) — cada página embebida reporta su alto
   (ver inject_resize_reporter.py) y aquí solo escuchamos ese mensaje. */
window.addEventListener('message', function(ev){
  if(!ev || !ev.data || !ev.data.umrResize) return;
  ['frame-costos','frame-reforma','frame-giros'].forEach(function(id){
    const f = document.getElementById(id);
    if(f && f.contentWindow === ev.source){
      f.style.height = Math.max(200, ev.data.height) + 'px';
    }
  });
});

const IFRAME_ROUTES = {
  costos:  { view: 'vista-costos',  frame: 'frame-costos',  src: 'assets/pages/costos.html' },
  reforma: { view: 'vista-reforma', frame: 'frame-reforma', src: 'assets/pages/reforma.html' },
  giros:   { view: 'vista-giros',   frame: 'frame-giros',   src: 'assets/pages/giros.html' },
};

function router(){
  const h=location.hash.replace(/^#/,'');
  const vh=document.getElementById('vista-home');
  const vb=document.getElementById('vista-busqueda');
  const vd=document.getElementById('vista-detalle');
  const allViews=[vh,vb,vd,
    document.getElementById('vista-costos'),
    document.getElementById('vista-reforma'),
    document.getElementById('vista-giros')];
  const mostrar=(el,nav)=>{ allViews.forEach(v=>{ if(v) v.style.display='none'; }); el.style.display='block'; cerrarQR(); setActiveNav(nav); window.scrollTo(0,0); };

  if(IFRAME_ROUTES[h]){
    const r = IFRAME_ROUTES[h];
    const view = document.getElementById(r.view);
    const frame = document.getElementById(r.frame);
    if(frame.getAttribute('data-loaded')!=='1'){
      frame.src = r.src;
      frame.setAttribute('data-loaded','1');
    }
    mostrar(view, h==='costos' ? 'ley' : h);
    return;
  }

  if(h==='buscar'){ mostrar(vb,'buscar'); abrirBusqueda(); return; }
  if(h==='blog'){ mostrar(vd,'blog'); renderBlog(); return; }
  if(h==='rutas'){ mostrar(vd,'rutas'); renderRutas(); return; }
  if(h==='inspectores'){ mostrar(vd,'inspectores'); renderInspectores(); return; }
  const mi=h.match(/inspector=([^&]+)/);
  if(mi){ const i=INSPECTORES.find(x=>x.id===decodeURIComponent(mi[1])); if(i){ mostrar(vd,'inspectores'); renderInspector(i); return; } }
  if(h==='inspecciones'){ mostrar(vd,'inspecciones'); renderInspecciones(); return; }
  const mx=h.match(/inspeccion=([^&]+)/);
  if(mx){ const x=INSPECCIONES.find(y=>y.slug===decodeURIComponent(mx[1])); if(x){ mostrar(vd,'inspecciones'); renderInspeccion(x); return; } }
  const mr=h.match(/ruta=([^&]+)/);
  if(mr){ const r=RUTAS.find(x=>x.slug===decodeURIComponent(mr[1])); if(r){ mostrar(vd,'rutas'); renderRuta(r); return; } }
  const mg=h.match(/guia=([^&]+)/);
  if(mg){ const g=GUIAS.find(x=>x.slug===decodeURIComponent(mg[1])); if(g){ mostrar(vd,'blog'); renderGuia(g); return; } }
  const mt=h.match(/t=([^&]+)/);
  if(mt){ const id=decodeURIComponent(mt[1]); const t=window.TRAMITES.find(x=>x.slug===id||x.clave===id); if(t){ mostrar(vd,'buscar'); renderDetalle(t); return; } }
  
  mostrar(vh,'home'); renderHome();
}

function poblarDependencias(){
  const sel=document.getElementById('f-dep');
  const counts={};
  window.TRAMITES.forEach(t=>counts[t.dependencia]=(counts[t.dependencia]||0)+1);
  (window.TRAMITES_EN_LINEA||[]).forEach(t=>counts[t.dependencia]=(counts[t.dependencia]||0)+1);
  Object.entries(counts).sort((a,b)=>b[1]-a[1]).forEach(([dep,n])=>{
    const o=document.createElement('option');o.value=dep;o.textContent=`${dep} (${n})`;sel.appendChild(o);
  });
}

function init(){
  GUIAS = window.GUIAS || [];
  RUTAS = window.RUTAS || [];
  const nT=(window.TRAMITES||[]).length;
  ["n-tramites-pie","n-tramites-copy"].forEach(id=>{const el=document.getElementById(id); if(el) el.textContent=nT;});
  INSPECTORES = (window.INSPECTORES && window.INSPECTORES.inspectores) ? window.INSPECTORES.inspectores : (window.INSPECTORES || []);
  INSPECCIONES = window.INSPECCIONES || [];
  construirIndice();
  construirCats();
  renderCats();
  poblarDependencias();

  const q=document.getElementById('q'), clear=document.getElementById('clear'), ac=document.getElementById('ac');
  let tmr;
  q.addEventListener('input',e=>{
    estado.q=e.target.value;
    clear.style.display = estado.q?"flex":"none";
    clearTimeout(tmr);
    tmr=setTimeout(()=>{buscar();autocompletar();},120);
  });
  q.addEventListener('keydown',e=>{
    const items=ac.querySelectorAll('.ac-item');
    if(ac.style.display==="none"||!items.length) return;
    if(e.key==="ArrowDown"){e.preventDefault();acIndex=Math.min(acIndex+1,items.length-1);}
    else if(e.key==="ArrowUp"){e.preventDefault();acIndex=Math.max(acIndex-1,0);}
    else if(e.key==="Enter"){if(acIndex>=0){elegirAc(acIndex);}ac.style.display="none";return;}
    else if(e.key==="Escape"){ac.style.display="none";return;}
    items.forEach((el,i)=>el.classList.toggle('active',i===acIndex));
  });
  clear.addEventListener('click',()=>{estado.q="";q.value="";clear.style.display="none";ac.style.display="none";buscar();q.focus();});
  document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap')) ac.style.display="none";});

  document.getElementById('f-dep').addEventListener('change',e=>{estado.dep=e.target.value;buscar();});
  document.querySelectorAll('input[name=tipo]').forEach(r=>r.addEventListener('change',e=>{estado.tipo=e.target.value;buscar();}));
  document.querySelectorAll('input[name=modalidad]').forEach(r=>r.addEventListener('change',e=>{estado.modalidad=e.target.value;buscar();}));
  document.querySelectorAll('input[name=costo]').forEach(r=>r.addEventListener('change',e=>{estado.costo=e.target.value;buscar();}));
  document.querySelectorAll('input[name=tiempo]').forEach(r=>r.addEventListener('change',e=>{estado.tiempo=e.target.value;buscar();}));
  document.getElementById('reset').addEventListener('click',()=>{
    estado.dep=estado.tipo=estado.costo=estado.tiempo=estado.catCiud=estado.modalidad="";
    document.getElementById('f-dep').value="";
    document.querySelectorAll('.radio-list input[value=""]').forEach(r=>r.checked=true);
    renderCats();buscar();
  });

  // Ruteo Fase 2: cierre de modal y navegación por hash
  document.getElementById('qr-modal').addEventListener('click',e=>{if(e.target.id==='qr-modal')cerrarQR();});
  window.addEventListener('hashchange',router);

  buscar();
  router();   
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{setTimeout(init,0);}
