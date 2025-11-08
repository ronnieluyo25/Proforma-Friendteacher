"use strict";

/********** Helpers **********/
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function esc(str){ const s=String(str??''); return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function toDMY(d){ const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); const yyyy=d.getFullYear(); return `${dd}/${mm}/${yyyy}`; }
function round2(n){ return Math.round((Number(n||0)+Number.EPSILON)*100)/100; }
function toNum(v){ const s=String(v??'').replace(/[^0-9.\-]/g,''); const n=parseFloat(s); return isNaN(n)?0:n; }
function clampInt(v,min,max){ v=parseInt(v,10); if(isNaN(v)) v=min; return Math.max(min,Math.min(max,v)); }

const DIAS = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

/********** Estado para PDF servidor **********/
window.FILAS_ACTUALES = [];
window.META_ACTUAL = { alumno:'', tutor:'', paquete:'' };

/********** Llenar selects desde API **********/
async function cargarSelect(url, selectEl, labelKey = 'nombre') {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    selectEl.innerHTML = data.map(it => `<option value="${esc(it[labelKey])}">${esc(it[labelKey])}</option>`).join('');
  } catch (e) {
    console.error('Error cargando', url, e);
    selectEl.innerHTML = `<option value="">(sin datos)</option>`;
  }
}

/********** Render tabla detalle (con totales) **********/
function renderDetalle(rows) {
  const thead = $('#tabla thead');
  const tbody = $('#tabla tbody');
  const tfoot = $('#tabla tfoot');
  if (!thead || !tbody || !tfoot) return;

  thead.innerHTML = `
    <tr>
      <th>Fecha</th><th>Día</th><th>Tutor</th>
      <th>Modalidad</th>
      <th class="text-right">Horas</th>
      <th class="text-right">Precio x Hora</th>
      <th class="text-right">Importe</th>
    </tr>`;

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${esc(r.fecha)}</td>
      <td>${esc(r.dia)}</td>
      <td>${esc(r.tutor)}</td>
      <td>${esc(r.modalidad)}</td>
      <td class="text-right">${Number(r.horas||0).toFixed(2)}</td>
      <td class="text-right">S/ ${Number(r.precioHora||0).toFixed(2)}</td>
      <td class="text-right font-semibold">S/ ${Number(r.importe||0).toFixed(2)}</td>
    </tr>`).join('');

  const totalHoras = rows.reduce((a,b)=>a+Number(b.horas||0),0);
  const totalImporte = rows.reduce((a,b)=>a+Number(b.importe||0),0);

  tfoot.innerHTML = `
    <tr>
      <td colspan="4" class="text-right font-semibold">TOTAL DE HORAS</td>
      <td class="text-right font-semibold">${totalHoras.toFixed(2)}</td>
      <td class="text-right font-semibold">TOTAL A PAGAR</td>
      <td class="text-right font-semibold text-blue-700">S/ ${totalImporte.toFixed(2)}</td>
    </tr>`;
}

/********** Generar proforma **********/
function generarProforma() {
  const nSecciones = clampInt($('#secciones')?.value, 1, 500);
  const fechaStr   = $('#fechaInicio')?.value || '';
  const alumno     = $('#alumno')?.value || '';
  const tutor      = $('#tutor')?.value || '';
  const modalidad  = $('#modalidad')?.value || '';
  const horasClase = toNum($('#horasClase')?.value);
  const precioHora = toNum($('#precioHora')?.value);

  const diasMarcados = $$('#dias input:checked').map(i => i.value);

  const start = new Date(fechaStr);
  const fechaValida = !isNaN(start.getTime());
  if (!alumno || !tutor || !modalidad || !fechaValida || diasMarcados.length === 0) {
    alert('Completa todos los campos, elige una fecha válida y marca al menos un día.');
    return;
  }
  if (!(horasClase > 0) || !(precioHora >= 0)) {
    alert('Horas y precio deben ser válidos.');
    return;
  }

  const filas = [];
  let d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (filas.length < nSecciones) {
    const dowName = DIAS[d.getDay()];
    if (diasMarcados.includes(dowName)) {
      const horas   = round2(horasClase);
      const precio  = round2(precioHora);
      const importe = round2(horas * precio);
      filas.push({
        fecha: toDMY(d),
        dia: dowName,
        tutor,
        modalidad,
        horas, precioHora: precio, importe
      });
    }
    d.setDate(d.getDate() + 1);
  }

  // Header PDF info
  const totalHoras = filas.reduce((a,b)=> a + Number(b.horas||0), 0);
  const phAlumno  = $('#phAlumno');
  const phTutor   = $('#phTutor');
  const phPaquete = $('#phPaquete');
  if (phAlumno)  phAlumno.textContent = alumno;
  if (phTutor)   phTutor.textContent  = tutor;
  if (phPaquete) phPaquete.textContent = `${nSecciones} ${nSecciones===1?'sesión':'sesiones'} - ${totalHoras.toFixed(2)} horas totales`;

  // Guardar estado para PDF servidor
  window.FILAS_ACTUALES = filas;
  window.META_ACTUAL = {
    alumno,
    tutor,
    paquete: `${nSecciones} ${nSecciones===1?'sesión':'sesiones'} - ${totalHoras.toFixed(2)} horas totales`
  };

  renderDetalle(filas);
  $('#exportArea')?.classList.remove('hidden');
  $('#pdfBtn').disabled = filas.length === 0;
  $('#pdfSrvBtn').disabled = filas.length === 0;
}

/********** PDF (cliente con html2pdf.js) **********/
function descargarPDF() {
  const el = document.getElementById('exportArea');
  if (!el) return;

  const alumnoSel = document.getElementById('alumno')?.value || 'Alumno';
  const alumnoSafe = String(alumnoSel).replace(/[\\/:*?"<>|]+/g, '_');

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `Proforma_${alumnoSafe}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 1,
      useCORS: true,
      logging: false
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    }
  };

  html2pdf().set(opt).from(el).save();
}

/********** PDF (servidor con /api/pdf) **********/
async function descargarPDFServidor() {
  const { alumno, tutor, paquete } = window.META_ACTUAL || {};
  const filas = window.FILAS_ACTUALES || [];

  if (!filas.length) {
    alert('Primero genera la proforma.');
    return;
  }

  const totales = {
    totalHoras: filas.reduce((a,b)=> a + Number(b.horas||0), 0),
    totalImporte: filas.reduce((a,b)=> a + Number(b.importe||0), 0)
  };

  const payload = { alumno, tutor, paquete, filas, totales };

  const resp = await fetch('/api/pdf', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    let err = {};
    try { err = await resp.json(); } catch {}
    console.error('PDF server error:', err);
    alert('No se pudo generar el PDF en servidor.');
    return;
  }

  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = String(alumno||'Alumno').replace(/[\\/:*?"<>|]+/g,'_');
  a.href = url;
  a.download = `Proforma_${safe}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/********** Init **********/
window.addEventListener('DOMContentLoaded', async () => {
  // Hoy
  const hoy = new Date();
  const spanHoy = $('#hoy');
  if (spanHoy) spanHoy.textContent = hoy.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' });

  // Días
  const contDias = $('#dias');
  DIAS.forEach(d => {
    const lbl = document.createElement('label');
    lbl.className = 'flex items-center gap-2 text-sm';
    lbl.innerHTML = `<input type="checkbox" class="accent-blue-600" value="${esc(d)}"> ${esc(d)}`;
    contDias.appendChild(lbl);
  });

  // Fecha inicio por defecto
  const fi = $('#fechaInicio');
  if (fi) fi.valueAsDate = hoy;

  // Cargar selects desde la API (Neon)
  await cargarSelect('/api/alumnos', $('#alumno'));
  await cargarSelect('/api/tutores', $('#tutor'));

  // Eventos
  $('#generarBtn').addEventListener('click', generarProforma);
  $('#pdfBtn').addEventListener('click', descargarPDF);
  $('#pdfSrvBtn').addEventListener('click', descargarPDFServidor);
});
