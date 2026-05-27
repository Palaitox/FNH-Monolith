/**
 * pdf-vars.ts — Contract variable computation helpers.
 * Ported from contract-gen.js; now typed and framework-agnostic.
 * Used by contract-pdf.tsx to build ContractVars from raw employee/contract data.
 */

import type { Employee } from '@/app/(shared)/lib/employee-types'

export interface OtroSiAmpliacionVars {
  // Encabezado tabla y línea de firma
  fechaEncabezado: string               // "13 DE MAYO DEL AÑO 2026"
  diaDocumento: string                  // "13"
  diaDocumentoPalabras: string          // "trece"
  mesDocumento: string                  // "mayo"
  anioDocumento: string                 // "2026"
  anioDocumentoPalabras: string         // "dos mil veintiséis"
  // Fechas del contrato original (del doc INICIAL del expediente)
  fechaInicioOriginalTexto: string      // "13 de febrero de 2026"
  fechaTerminacionOriginalTexto: string // "12 de mayo de 2026"
  // Nuevas fechas de extensión en mayúsculas + palabras (para cláusula PRIMERA)
  fechaInicioNuevaMayusculas: string    // "TRECE (13) DE MAYO DE 2026"
  fechaTerminacionNuevaMayusculas: string // "DIEZ Y OCHO (18) DE JULIO DE 2026"
  // Preaviso (30 días antes del nuevo fin) — para la carta de la página 3
  diaPreavisoTexto: string              // "18"
  mesPreavisoTexto: string             // "junio"
  anioPreavisoTexto: string            // "2026"
  // Vigencia completa para el preaviso: inicio original → nuevo fin
  fechaInicioOriginalPreaviso: string   // "13 de Febrero de 2026"
  fechaTerminacionNuevaPreaviso: string // "18 Julio de 2026"
}

export interface ContractVars {
  contrato_numero: string
  trabajador_nombre: string
  trabajador_cargo: string
  trabajador_cedula: string
  trabajador_ciudad_cedula: string
  trabajador_telefono: string
  trabajador_correo: string
  salario_texto: string
  salario_valor: string
  fecha_inicio_texto: string
  fecha_terminacion_texto: string
  lugar_trabajo: string
  dia_inicio: string
  mes_inicio: string
  anio_inicio: string
  dia_preaviso: string
  mes_preaviso: string
  anio_preaviso: string
  duracion_dias_texto: string
  valor_total_contrato: string
  /** Base64 PNG data URL of the worker's captured signature. Undefined = show empty placeholder. */
  firma?: string
  /** Base64 PNG data URL of the legal representative's signature. Undefined = show empty placeholder. */
  firma_representante?: string
  /** Employee's jornada label for Otro Sí title (e.g. "JORNADA COMPLETA") */
  trabajador_jornada?: string
  /** Populated only for OTRO_SI (Ampliación) documents. */
  otroSiAmpliacion?: OtroSiAmpliacionVars
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const MESES_CAP = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const MESES_UPPER = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

const DIAS_PALABRAS: Record<number, string> = {
  1: 'uno', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco',
  6: 'seis', 7: 'siete', 8: 'ocho', 9: 'nueve', 10: 'diez',
  11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince',
  16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve',
  20: 'veinte', 21: 'veintiuno', 22: 'veintidós', 23: 'veintitrés',
  24: 'veinticuatro', 25: 'veinticinco', 26: 'veintiséis', 27: 'veintisiete',
  28: 'veintiocho', 29: 'veintinueve', 30: 'treinta', 31: 'treinta y uno',
}

const ANIOS_PALABRAS: Record<number, string> = {
  2024: 'dos mil veinticuatro',
  2025: 'dos mil veinticinco',
  2026: 'dos mil veintiséis',
  2027: 'dos mil veintisiete',
  2028: 'dos mil veintiocho',
  2029: 'dos mil veintinueve',
  2030: 'dos mil treinta',
  2031: 'dos mil treinta y uno',
  2032: 'dos mil treinta y dos',
  2033: 'dos mil treinta y tres',
  2034: 'dos mil treinta y cuatro',
  2035: 'dos mil treinta y cinco',
}

function extractDay(dateStr: string): string {
  if (!dateStr) return ''
  return String(parseInt(dateStr.split('-')[2]))
}

function extractMonth(dateStr: string): string {
  if (!dateStr) return ''
  return MESES[parseInt(dateStr.split('-')[1]) - 1] ?? ''
}

function extractMonthIndex(dateStr: string): number {
  if (!dateStr) return 0
  return parseInt(dateStr.split('-')[1]) - 1
}

function extractYear(dateStr: string): string {
  if (!dateStr) return ''
  return dateStr.split('-')[0]
}

function formatCedula(cedula: string): string {
  if (!cedula) return ''
  const str = String(cedula).replace(/\D/g, '')
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function buildSalaryText(salarioBase: number | null, auxilioTransporte: number): string {
  if (!salarioBase) return ''
  const fmt = (n: number) => new Intl.NumberFormat('es-CO').format(Math.round(n))
  const salStr = fmt(salarioBase)
  if (auxilioTransporte > 0) {
    const total = salarioBase + auxilioTransporte
    return `${salStr} pesos más auxilio de transporte por valor de ${fmt(auxilioTransporte)} pesos para un total de ${fmt(total)} pesos mensuales`
  }
  return `${salStr} pesos mensuales`
}

function calcDuracionDias(fechaInicio: string, fechaTerminacion: string): number {
  if (!fechaInicio || !fechaTerminacion) return 0
  const d1 = new Date(fechaInicio + 'T00:00:00')
  const d2 = new Date(fechaTerminacion + 'T00:00:00')
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86400000))
}

function buildDuracionTexto(days: number): string {
  const words: Record<number, string> = {
    30: 'treinta', 60: 'sesenta', 90: 'noventa', 120: 'ciento veinte',
    180: 'ciento ochenta', 365: 'trescientos sesenta y cinco',
  }
  const word = words[days] ?? String(days)
  return `${word} (${days}) días`
}

function calcPreaviso(fechaTerminacion: string, fechaInicio: string): string {
  if (!fechaTerminacion) return fechaInicio
  const d = new Date(fechaTerminacion + 'T00:00:00')
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

/** "13 DE MAYO DEL AÑO 2026" — formato encabezado tabla Otro Sí */
function fechaEncabezado(dateStr: string): string {
  if (!dateStr) return ''
  const day = parseInt(dateStr.split('-')[2])
  const idx = extractMonthIndex(dateStr)
  const year = extractYear(dateStr)
  return `${day} DE ${MESES_UPPER[idx]} DEL AÑO ${year}`
}

/** "TRECE (13) DE MAYO DE 2026" — formato cláusulas Otro Sí */
function fechaMayusculas(dateStr: string): string {
  if (!dateStr) return ''
  const day = parseInt(dateStr.split('-')[2])
  const idx = extractMonthIndex(dateStr)
  const year = extractYear(dateStr)
  const palabras = (DIAS_PALABRAS[day] ?? String(day)).toUpperCase()
  return `${palabras} (${day}) DE ${MESES_UPPER[idx]} DE ${year}`
}

/** "13 de Febrero de 2026" — formato preaviso (día numérico, mes capitalizado) */
function fechaPreavisoCapitalizada(dateStr: string): string {
  if (!dateStr) return ''
  const day = parseInt(dateStr.split('-')[2])
  const idx = extractMonthIndex(dateStr)
  const year = extractYear(dateStr)
  return `${day} de ${MESES_CAP[idx]} de ${year}`
}

/** "18 Julio de 2026" — formato vigencia en preaviso (sin "de" antes del mes) */
function fechaVigenciaPreaviso(dateStr: string): string {
  if (!dateStr) return ''
  const day = parseInt(dateStr.split('-')[2])
  const idx = extractMonthIndex(dateStr)
  const year = extractYear(dateStr)
  return `${day} ${MESES_CAP[idx]} de ${year}`
}

function buildOtroSiAmpliacion(data: {
  fechaInicioOriginal: string
  fechaTerminacionOriginal: string
  fechaInicioNueva: string
  fechaTerminacionNueva: string
}): OtroSiAmpliacionVars {
  const { fechaInicioOriginal, fechaTerminacionOriginal, fechaInicioNueva, fechaTerminacionNueva } = data

  const diaNum = parseInt(fechaInicioNueva.split('-')[2] ?? '1')
  const anioNum = parseInt(extractYear(fechaInicioNueva) || '2026')

  const fechaPreaviso = calcPreaviso(fechaTerminacionNueva, fechaInicioNueva)

  return {
    fechaEncabezado: fechaEncabezado(fechaInicioNueva),
    diaDocumento: String(diaNum),
    diaDocumentoPalabras: DIAS_PALABRAS[diaNum] ?? String(diaNum),
    mesDocumento: extractMonth(fechaInicioNueva),
    anioDocumento: extractYear(fechaInicioNueva),
    anioDocumentoPalabras: ANIOS_PALABRAS[anioNum] ?? extractYear(fechaInicioNueva),
    fechaInicioOriginalTexto: fechaInicioOriginal
      ? `${parseInt(extractDay(fechaInicioOriginal))} de ${extractMonth(fechaInicioOriginal)} de ${extractYear(fechaInicioOriginal)}`
      : '',
    fechaTerminacionOriginalTexto: fechaTerminacionOriginal
      ? `${parseInt(extractDay(fechaTerminacionOriginal))} de ${extractMonth(fechaTerminacionOriginal)} de ${extractYear(fechaTerminacionOriginal)}`
      : '',
    fechaInicioNuevaMayusculas: fechaMayusculas(fechaInicioNueva),
    fechaTerminacionNuevaMayusculas: fechaMayusculas(fechaTerminacionNueva),
    diaPreavisoTexto: extractDay(fechaPreaviso),
    mesPreavisoTexto: extractMonth(fechaPreaviso),
    anioPreavisoTexto: extractYear(fechaPreaviso),
    fechaInicioOriginalPreaviso: fechaPreavisoCapitalizada(fechaInicioOriginal),
    fechaTerminacionNuevaPreaviso: fechaVigenciaPreaviso(fechaTerminacionNueva),
  }
}

export function buildContractVars(
  employee: Employee,
  contractData: {
    numeroContrato: string
    fechaInicio: string
    fechaTerminacion?: string
    lugarTrabajo: string
    otroSiData?: {
      fechaInicioOriginal: string
      fechaTerminacionOriginal: string
      fechaInicioNueva: string
      fechaTerminacionNueva: string
    }
  },
): ContractVars {
  const { numeroContrato, fechaInicio, fechaTerminacion = '', lugarTrabajo, otroSiData } = contractData

  const cedulaFormatted = formatCedula(employee.cedula)
  const salarioBase = employee.salario_base ?? 0
  const auxilioTransporte = employee.auxilio_transporte ?? 0

  const fechaPreaviso = calcPreaviso(fechaTerminacion, fechaInicio)
  const durDias = calcDuracionDias(fechaInicio, fechaTerminacion)
  const mesesAprox = Math.round(durDias / 30)
  const valorTotal = salarioBase ? Math.round(salarioBase * (mesesAprox || 1)) : 0

  return {
    contrato_numero: numeroContrato,
    trabajador_nombre: employee.full_name,
    trabajador_cargo: employee.cargo ?? '',
    trabajador_cedula: cedulaFormatted,
    trabajador_ciudad_cedula: employee.ciudad_cedula ?? '',
    trabajador_telefono: employee.telefono ?? '',
    trabajador_correo: employee.correo ?? '',
    salario_texto: buildSalaryText(salarioBase, auxilioTransporte),
    salario_valor: salarioBase
      ? new Intl.NumberFormat('es-CO').format(Math.round(salarioBase))
      : '',
    fecha_inicio_texto: fechaInicio
      ? `${parseInt(extractDay(fechaInicio))} de ${extractMonth(fechaInicio)} de ${extractYear(fechaInicio)}`
      : '',
    fecha_terminacion_texto: fechaTerminacion
      ? `${parseInt(extractDay(fechaTerminacion))} de ${extractMonth(fechaTerminacion)} de ${extractYear(fechaTerminacion)}`
      : '',
    lugar_trabajo: lugarTrabajo,
    dia_inicio: extractDay(fechaInicio),
    mes_inicio: extractMonth(fechaInicio),
    anio_inicio: extractYear(fechaInicio),
    dia_preaviso: extractDay(fechaPreaviso),
    mes_preaviso: extractMonth(fechaPreaviso),
    anio_preaviso: extractYear(fechaPreaviso),
    duracion_dias_texto: buildDuracionTexto(durDias),
    valor_total_contrato: valorTotal
      ? new Intl.NumberFormat('es-CO').format(valorTotal)
      : '',
    trabajador_jornada:
      employee.jornada_laboral === 'tiempo_completo'
        ? 'JORNADA COMPLETA'
        : employee.jornada_laboral === 'medio_tiempo'
          ? 'JORNADA PARCIAL'
          : 'PRESTACION DE SERVICIOS',
    otroSiAmpliacion: otroSiData ? buildOtroSiAmpliacion(otroSiData) : undefined,
  }
}
