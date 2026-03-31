/**
 * excel-importer.ts — pure parse + diff logic (ND-4)
 *
 * No DOM, no side effects. Accepts an ArrayBuffer so it works in both
 * browser (File.arrayBuffer()) and Node.js contexts.
 *
 * Two-phase import contract (ND-4):
 *   Phase 1 — parse:   parseExcelEmployees(buffer) → ExcelImportResult
 *   Phase 2 — confirm: Server Action bulkUpsertEmployees(employees) in actions/contracts.ts
 *
 * No database write happens before user confirmation.
 */

import * as XLSX from 'xlsx'
import type { Employee, ExcelEmployee, ExcelImportResult, ImportDiff, JornadaLaboral } from '@/app/contracts/types'

export async function parseExcelEmployees(buffer: ArrayBuffer): Promise<ExcelImportResult> {
  const data = new Uint8Array(buffer)
  const workbook = XLSX.read(data, { type: 'array', cellDates: false })

  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as (string | number | null)[][]

  // Find the header row dynamically (looks for NOMBRE + CEDULA)
  let headerRowIndex = -1
  let headers: string[] = []

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i].map((cell) => String(cell ?? '').trim().toUpperCase())
    const hasNombre = row.includes('NOMBRE')
    const hasCedula =
      row.includes('CEDULA') || row.includes('CÉDULA') || row.includes('DOCUMENTO')
    if (hasNombre && hasCedula) {
      headerRowIndex = i
      headers = row
      break
    }
  }

  if (headerRowIndex === -1) {
    throw new Error(
      'No se encontró la fila de encabezados (NOMBRE y CEDULA/DOCUMENTO) en el archivo Excel.',
    )
  }

  // Map column indices
  const col = {
    nombre: headers.indexOf('NOMBRE'),
    cedula: headers.findIndex((h) => h === 'CEDULA' || h === 'CÉDULA' || h === 'DOCUMENTO'),
    telefono: headers.findIndex((h) => h === 'TELEFONO' || h === 'TELÉFONO'),
    correo: headers.findIndex((h) => h === 'CORREO' || h.includes('CORREO')),
    cargo: headers.findIndex((h) => h === 'CARGO'),
    salarioBase: headers.findIndex(
      (h) =>
        (h.includes('SALARIO') && h.includes('BASE')) ||
        h === 'SALARIO' ||
        h.includes('VALOR PRESTACION') ||
        h.includes('PRESTACION DE SERVICIO'),
    ),
    auxilioTransporte: headers.findIndex(
      (h) => h.includes('AUXILIO') || h.includes('TRANSPORTE'),
    ),
    jornadaLaboral: headers.findIndex(
      (h) => h.includes('JORNADA') || h.includes('TIPO'),
    ),
    fechaInicio: headers.findIndex(
      (h) => h.includes('FECHA') && h.includes('INICIO'),
    ),
  }

  const employees: ExcelEmployee[] = []
  const warnings: string[] = []

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every((cell) => cell === '' || cell === null || cell === undefined))
      continue

    const nombre = col.nombre >= 0 ? String(row[col.nombre] ?? '').trim() : ''
    const cedulaRaw = col.cedula >= 0 ? row[col.cedula] : ''
    const cedula = String(cedulaRaw ?? '')
      .trim()
      .replace(/[.\s]/g, '')

    // Skip rows without both nombre and cedula (section dividers, empty rows)
    if (!nombre || !cedula || nombre.length < 3 || isNaN(Number(cedula))) continue
    if (nombre === nombre.toUpperCase() && nombre.split(' ').length === 1 && isNaN(Number(cedula)))
      continue

    const salario_base = parseColombianNumber(row[col.salarioBase] ?? 0)
    const auxilio_transporte = parseColombianNumber(
      col.auxilioTransporte >= 0 ? (row[col.auxilioTransporte] ?? 0) : 0,
    )

    if (salario_base === 0) {
      warnings.push(`Fila ${i + 1}: ${nombre} no tiene salario base definido.`)
    }

    const jornadaRaw =
      col.jornadaLaboral >= 0
        ? String(row[col.jornadaLaboral] ?? '').trim().toUpperCase()
        : ''

    let jornada_laboral: JornadaLaboral = 'tiempo_completo'
    if (jornadaRaw.includes('PARCIAL') || jornadaRaw.includes('MEDIO')) {
      jornada_laboral = 'medio_tiempo'
    } else if (jornadaRaw.includes('CONTRATISTA') || jornadaRaw.includes('SERVICIO')) {
      jornada_laboral = 'prestacion_servicios'
    }

    employees.push({
      full_name: nombre.toUpperCase(),
      cedula,
      telefono: String(
        col.telefono >= 0 ? (row[col.telefono] ?? '') : '',
      )
        .trim()
        .replace(/\D/g, ''),
      correo: String(col.correo >= 0 ? (row[col.correo] ?? '') : '')
        .trim()
        .toLowerCase(),
      cargo: String(col.cargo >= 0 ? (row[col.cargo] ?? '') : '')
        .trim()
        .toUpperCase(),
      salario_base,
      auxilio_transporte,
      jornada_laboral,
      source: 'excel',
    })
  }

  return {
    employees,
    warnings,
    sheetName,
    totalRows: rows.length - headerRowIndex - 1,
  }
}

/**
 * Computes the diff between existing DB employees and newly parsed ones.
 * Returns { new, updated, unchanged } — no writes, only comparison.
 */
export function diffEmployees(existing: Employee[], incoming: ExcelEmployee[]): ImportDiff {
  const existingMap: Record<string, Employee> = {}
  existing.forEach((e) => {
    existingMap[e.cedula] = e
  })

  const result: ImportDiff = { new: [], updated: [], unchanged: [] }

  incoming.forEach((emp) => {
    const found = existingMap[emp.cedula]
    if (!found) {
      result.new.push(emp)
    } else {
      const changed =
        found.full_name !== emp.full_name ||
        found.cargo !== emp.cargo ||
        found.salario_base !== emp.salario_base ||
        found.correo !== emp.correo ||
        found.jornada_laboral !== emp.jornada_laboral
      if (changed) {
        result.updated.push({ old: found, new: emp })
      } else {
        result.unchanged.push(emp)
      }
    }
  })

  return result
}

/**
 * Parses a Colombian-formatted number.
 * Handles: 1.750.905 / 1,750,905 / 1750905 / "249,095.00"
 */
function parseColombianNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Math.round(value * 100) / 100

  let str = String(value).trim()

  const dotCount = (str.match(/\./g) ?? []).length
  const commaCount = (str.match(/,/g) ?? []).length

  if (dotCount > 1) {
    str = str.replace(/\./g, '').replace(',', '.')
  } else if (commaCount > 1) {
    str = str.replace(/,/g, '')
  } else if (dotCount === 1 && commaCount === 1) {
    const dotPos = str.indexOf('.')
    const commaPos = str.indexOf(',')
    if (dotPos < commaPos) {
      str = str.replace('.', '').replace(',', '.')
    } else {
      str = str.replace(',', '')
    }
  } else if (commaCount === 1) {
    const afterComma = str.split(',')[1]
    if (afterComma && afterComma.length === 3) {
      str = str.replace(',', '')
    } else {
      str = str.replace(',', '.')
    }
  }

  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}
