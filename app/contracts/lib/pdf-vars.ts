/**
 * pdf-vars.ts — Contract variable computation helpers.
 * Ported from contract-gen.js; now typed and framework-agnostic.
 * Used by contract-pdf.tsx to build ContractVars from raw employee/contract data.
 */

import type { Employee } from '@/app/(shared)/lib/employee-types'

export interface ContractVars {
  contrato_numero: string
  trabajador_nombre: string
  trabajador_cargo: string
  trabajador_cedula: string
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
  /** Base64 PNG data URL of the captured signature. Undefined = show empty placeholder. */
  firma?: string
  /** Employee's jornada label for Otro Sí title (e.g. "JORNADA COMPLETA") */
  trabajador_jornada?: string
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function extractDay(dateStr: string): string {
  if (!dateStr) return ''
  return String(parseInt(dateStr.split('-')[2]))
}

function extractMonth(dateStr: string): string {
  if (!dateStr) return ''
  return MESES[parseInt(dateStr.split('-')[1]) - 1] ?? ''
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

export function buildContractVars(
  employee: Employee,
  contractData: {
    numeroContrato: string
    fechaInicio: string
    fechaTerminacion?: string
    lugarTrabajo: string
  },
): ContractVars {
  const { numeroContrato, fechaInicio, fechaTerminacion = '', lugarTrabajo } = contractData

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
  }
}
