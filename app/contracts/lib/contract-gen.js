// contract-gen.js — ported from contratos/js/contract-gen.js
// All function bodies are unchanged from the original.
// Module format converted: CDN globals → npm imports.
// This module is BROWSER-ONLY: downloadContract() uses file-saver (saveAs).
// generateContractDocx() can be called from Client Components only.

import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { saveAs } from 'file-saver'

/**
 * Generates a contract .docx file from a template and employee data.
 *
 * @param {Object} employee - Employee record shaped by mapEmployeeForContractGen()
 * @param {Object} contractData - { numeroContrato, tipoContrato, fechaInicio, fechaTerminacion, lugarTrabajo, formaPago }
 * @param {string} templateB64 - Base64-encoded .docx template
 * @param {Object} [settings] - Optional settings from getSettings() for employer data
 * @returns {Blob} - The generated .docx as a Blob, or throws on error
 */
export function generateContractDocx(employee, contractData, templateB64, settings = {}) {
  if (!templateB64) {
    throw new Error('No hay plantilla cargada. Por favor cargue la plantilla en Configuración.');
  }

  // 1. Decode base64 → binary string → PizZip
  const binaryStr = atob(templateB64);
  const zip = new PizZip(binaryStr);

  // 2. Create docxtemplater instance
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' }
  });

  // 3. Build all template variables
  const vars = buildTemplateVars(employee, contractData, settings);

  // 4. Render
  doc.setData(vars);
  try {
    doc.render();
  } catch (err) {
    const errors = err.properties && err.properties.errors;
    if (errors && errors.length > 0) {
      const messages = errors.map(e => e.message || String(e)).join('; ');
      throw new Error('Error al generar el contrato: ' + messages);
    }
    throw err;
  }

  // 5. Export as Blob
  const out = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE'
  });

  return out;
}

/**
 * Builds the template variable map from employee + contract data.
 * @param {Object} settings - from getSettings(), used for employer info
 */
export function buildTemplateVars(employee, contractData, settings = {}) {
  const {
    numeroContrato, fechaInicio, fechaTerminacion, lugarTrabajo, formaPago, duracionDias
  } = contractData;

  const salarioTexto          = buildSalaryText(employee.salarioBase, employee.auxilioTransporte);
  const fechaInicioTexto      = formatDateLong(fechaInicio);
  const fechaTerminacionTexto = formatDateLong(fechaTerminacion);
  const fechaCierreTexto      = formatDateWords(fechaInicio);
  const dia                   = extractDay(fechaInicio);
  const mes                   = extractMonth(fechaInicio);
  const anio                  = extractYear(fechaInicio);
  const mesTerminacion        = extractMonth(fechaTerminacion);
  const cedulaFormatted       = formatCedula(employee.cedula);

  // ── Pre-aviso: fecha de emisión = 30 días antes de la terminación ─────────
  const fechaPreaviso = contractData.fechaPreaviso || (() => {
    if (!fechaTerminacion) return fechaInicio;
    const d = new Date(fechaTerminacion + 'T00:00:00');
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();
  const diaPreaviso   = extractDay(fechaPreaviso);
  const mesPreaviso   = extractMonth(fechaPreaviso);
  const anioPreaviso  = extractYear(fechaPreaviso);

  // ── Prestación de Servicios specific ───────────────────────────────────
  const salarioValor          = employee.salarioBase
    ? new Intl.NumberFormat('es-CO').format(Math.round(employee.salarioBase))
    : '';
  const durDias               = duracionDias || calcDuracionDias(fechaInicio, fechaTerminacion);
  const durDiasTexto          = buildDuracionTexto(durDias);
  const mesesAprox            = Math.round(durDias / 30);
  const valorTotal            = employee.salarioBase
    ? Math.round(employee.salarioBase * (mesesAprox || 1))
    : 0;
  const valorTotalFormateado  = valorTotal
    ? new Intl.NumberFormat('es-CO').format(valorTotal)
    : '';

  return {
    contrato_numero:           numeroContrato,
    trabajador_nombre:         employee.nombre,
    trabajador_cargo:          employee.cargo,
    salario_texto:             salarioTexto,
    fecha_inicio_texto:        fechaInicioTexto,
    fecha_terminacion_texto:   fechaTerminacionTexto,
    lugar_trabajo:             lugarTrabajo,
    dia_inicio:                dia,
    mes_inicio:                mes,
    anio_inicio:               anio,
    mes_terminacion:           mesTerminacion,
    trabajador_cedula:         cedulaFormatted,
    salario_valor:             salarioValor,
    valor_total_contrato:      valorTotalFormateado,
    duracion_dias_texto:       durDiasTexto,
    trabajador_telefono:       employee.telefono || '',
    trabajador_correo:         employee.correo   || '',
    trabajador_ciudad:         employee.ciudad   || '',
    dia_preaviso:              diaPreaviso,
    mes_preaviso:              mesPreaviso,
    anio_preaviso:             anioPreaviso,
    ciudad_sede:               settings.ciudadSede || 'Guadalajara de Buga',
    trabajador_nombre_completo: employee.nombre,
    trabajador_nombre_firma:    employee.nombre,
    trabajador_cedula_firma:    cedulaFormatted,
    cargo_funciones:            (employee.cargo || '').toLowerCase(),
    fecha_cierre_texto:         fechaCierreTexto,
    forma_pago:                 formaPago || '',
    empleador_nombre:           settings.empleadorNombre  || 'FUNDACION NUEVO HORIZONTE',
    empleador_nit:              settings.empleadorNit     || '821.003.251-4',
    empleador_representante:    settings.empleadorRepresentante || 'REPRESENTANTE LEGAL',
  };
}

/**
 * Downloads a contract .docx for the given employee and contract data.
 */
export function downloadContract(employee, contractData, templateB64, settings = {}) {
  const blob = generateContractDocx(employee, contractData, templateB64, settings);
  const safeName = employee.nombre.replace(/[^A-Z\s]/gi, '').trim().replace(/\s+/g, '_');
  const filename = `Contrato_${contractData.numeroContrato}_${safeName}.docx`;
  saveAs(blob, filename);
  return { blob, filename };
}

/**
 * Reads a .docx file from a File object and returns its base64 string.
 */
export function readDocxAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const bytes = new Uint8Array(e.target.result);
      let binary = '';
      bytes.forEach(b => { binary += String.fromCharCode(b); });
      resolve(btoa(binary));
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo de plantilla.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Validates that a base64 docx template has the expected placeholders.
 */
export function validateTemplate(templateB64, tipo = 'laboral') {
  const EXPECTED_LABORAL = [
    'contrato_numero', 'trabajador_nombre', 'trabajador_cargo', 'salario_texto',
    'fecha_inicio_texto', 'fecha_terminacion_texto', 'lugar_trabajo',
    'trabajador_cedula', 'dia_inicio', 'mes_inicio', 'anio_inicio',
    'dia_preaviso', 'mes_preaviso', 'anio_preaviso', 'ciudad_sede'
  ];
  const EXPECTED_PS = [
    'contrato_numero', 'trabajador_nombre', 'trabajador_cargo', 'salario_texto',
    'fecha_inicio_texto', 'fecha_terminacion_texto',
    'trabajador_cedula', 'dia_inicio', 'mes_inicio', 'anio_inicio'
  ];
  const EXPECTED = tipo === 'prestacion_servicios' ? EXPECTED_PS : EXPECTED_LABORAL;

  try {
    const binaryStr = atob(templateB64);
    const zip = new PizZip(binaryStr);
    const docXml = zip.file('word/document.xml').asText();
    const found = EXPECTED.filter(p => docXml.includes('{' + p + '}'));
    const missing = EXPECTED.filter(p => !docXml.includes('{' + p + '}'));
    return { valid: missing.length === 0, found, missing };
  } catch (err) {
    return { valid: false, found: [], missing: EXPECTED, error: err.message };
  }
}

// ── Date / salary helpers (unchanged from original) ────────────────────────

function calcDuracionDias(fechaInicio, fechaTerminacion) {
  if (!fechaInicio || !fechaTerminacion) return 0;
  const d1 = new Date(fechaInicio + 'T00:00:00');
  const d2 = new Date(fechaTerminacion + 'T00:00:00');
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}

function buildDuracionTexto(days) {
  const words = {
    30: 'treinta', 60: 'sesenta', 90: 'noventa', 120: 'ciento veinte',
    180: 'ciento ochenta', 365: 'trescientos sesenta y cinco'
  };
  const word = words[days] || String(days);
  return `${word} (${days}) días`;
}

function buildSalaryText(salarioBase, auxilioTransporte) {
  if (!salarioBase) return '';
  const fmt = n => new Intl.NumberFormat('es-CO').format(Math.round(n));
  const salStr = fmt(salarioBase);
  if (auxilioTransporte && auxilioTransporte > 0) {
    const total = salarioBase + auxilioTransporte;
    return `${salStr} pesos más auxilio de transporte por valor de ${fmt(auxilioTransporte)} pesos para un total de ${fmt(total)} pesos mensuales`;
  }
  return `${salStr} pesos mensuales`;
}

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatDateLong(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} de ${MESES[parseInt(m) - 1]} de ${y}`;
}

function formatDateWords(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} de ${MESES[parseInt(m) - 1]} del año ${y}`;
}

function extractDay(dateStr) {
  if (!dateStr) return '';
  return String(parseInt(dateStr.split('-')[2]));
}

function extractMonth(dateStr) {
  if (!dateStr) return '';
  return MESES[parseInt(dateStr.split('-')[1]) - 1] || '';
}

function extractYear(dateStr) {
  if (!dateStr) return '';
  return dateStr.split('-')[0];
}

function formatCedula(cedula) {
  if (!cedula) return '';
  const str = String(cedula).replace(/\D/g, '');
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
