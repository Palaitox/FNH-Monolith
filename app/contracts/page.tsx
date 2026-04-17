import Link from 'next/link'
import { listContracts } from '@/app/contracts/actions/contracts'
import { getUserRole } from '@/app/(shared)/lib/auth'
import { createClient } from '@/lib/server'
import { getActiveLeavesMap } from '@/app/(shared)/lib/db'
import ContractsList, { type CaseGroup, type VigencyStatus } from './ContractsList'
import type { ContractDocumentFull } from '@/app/contracts/types'
import type { EmployeeLeave } from '@/app/(shared)/lib/employee-types'

function computeVigency(
  fechaInicio: string | null | undefined,
  currentEndDate: string | null | undefined,
): { status: VigencyStatus; daysLeft: number | null } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (!fechaInicio) return { status: 'vigente', daysLeft: null }
  const start = new Date(fechaInicio)
  start.setHours(0, 0, 0, 0)
  if (start > today) return { status: 'no_iniciado', daysLeft: null }
  if (!currentEndDate) return { status: 'indefinido', daysLeft: null }
  const end = new Date(currentEndDate)
  end.setHours(0, 0, 0, 0)
  const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0)   return { status: 'vencido', daysLeft }
  if (daysLeft <= 30) return { status: 'por_vencer', daysLeft }
  return { status: 'vigente', daysLeft }
}

function groupByCases(
  contracts: ContractDocumentFull[],
  activeLeavesMap: Map<string, EmployeeLeave>,
): CaseGroup[] {
  const map = new Map<string, CaseGroup>()

  for (const doc of contracts) {
    const caseId = doc.case_id
    if (!map.has(caseId)) {
      map.set(caseId, {
        caseId,
        caseNumber: doc.contract_cases?.case_number ?? '—',
        employeeName: doc.contract_cases?.employees?.full_name ?? '—',
        employeeId: doc.contract_cases?.employee_id,
        endDate: doc.contract_cases?.current_end_date ?? null,
        vigency: 'vigente',
        daysLeft: null,
        docs: [],
      })
    }
    map.get(caseId)!.docs.push({
      id: doc.id,
      case_id: doc.case_id,
      document_type: doc.document_type,
      fecha_inicio: doc.fecha_inicio,
      estado: doc.estado,
      generated_at: doc.generated_at,
    })
  }

  for (const group of map.values()) {
    group.docs.sort((a, b) => {
      if (a.document_type === 'INICIAL') return -1
      if (b.document_type === 'INICIAL') return 1
      return new Date(a.generated_at).getTime() - new Date(b.generated_at).getTime()
    })
    const inicial = group.docs.find((d) => d.document_type === 'INICIAL')
    const effectiveEndDate = group.endDate ?? inicial?.fecha_inicio ?? null

    // Use INICIAL's fecha_terminacion from original docs as fallback for endDate
    const originalInicial = contracts.find(
      (c) => c.case_id === group.caseId && c.document_type === 'INICIAL'
    )
    const resolvedEndDate = group.endDate ?? originalInicial?.fecha_terminacion ?? null
    group.endDate = resolvedEndDate

    const vigency = computeVigency(inicial?.fecha_inicio, resolvedEndDate)
    let status = vigency.status
    const daysLeft = vigency.daysLeft
    // Override vencido → en_licencia when employee has active leave
    if (status === 'vencido' && group.employeeId && activeLeavesMap.has(group.employeeId)) {
      status = 'en_licencia'
    }
    group.vigency = status
    group.daysLeft = daysLeft
  }

  const order: Record<VigencyStatus, number> = {
    por_vencer: 0, vigente: 1, en_licencia: 2, indefinido: 3, no_iniciado: 4, vencido: 5,
  }
  return Array.from(map.values()).sort((a, b) => {
    const od = order[a.vigency] - order[b.vigency]
    return od !== 0 ? od : b.caseNumber.localeCompare(a.caseNumber)
  })
}

export default async function ContractsPage() {
  const supabase = await createClient()
  const [contracts, role, activeLeavesMap] = await Promise.all([
    listContracts(),
    getUserRole(),
    getActiveLeavesMap(supabase),
  ])
  const cases = groupByCases(contracts, activeLeavesMap)

  return (
    <div className="px-4 py-6 sm:px-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            {cases.length} expediente{cases.length !== 1 ? 's' : ''} · {contracts.length} documento{contracts.length !== 1 ? 's' : ''}
          </p>
        </div>
        {role !== 'viewer' && (
          <Link
            href="/contracts/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors self-start"
          >
            + Nuevo contrato inicial
          </Link>
        )}
      </div>

      <ContractsList cases={cases} totalDocs={contracts.length} role={role} />
    </div>
  )
}
