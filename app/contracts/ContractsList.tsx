'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { FileText, CheckSquare, Clock, GitBranch, CalendarClock, ChevronDown, ChevronRight } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

export type VigencyStatus = 'vigente' | 'por_vencer' | 'vencido' | 'no_iniciado' | 'indefinido' | 'en_licencia'

export interface CaseGroup {
  caseId: string
  caseNumber: string
  employeeName: string
  employeeId: string | undefined
  endDate: string | null
  vigency: VigencyStatus
  daysLeft: number | null
  docs: {
    id: string
    case_id: string
    document_type: string
    fecha_inicio: string | null
    estado: string
    generated_at: string
  }[]
}

// ── Constants ─────────────────────────────────────────────────────────────

const DOCTYPE_LABEL: Record<string, string> = {
  INICIAL:     'Contrato inicial',
  PRORROGA:    'Prórroga',
  OTRO_SI:     'Otro Sí',
  TERMINACION: 'Terminación',
}

const DOCTYPE_COLOR: Record<string, string> = {
  INICIAL:     'text-sky-400 bg-sky-400/10 border-sky-400/20',
  PRORROGA:    'text-violet-400 bg-violet-400/10 border-violet-400/20',
  OTRO_SI:     'text-amber-400 bg-amber-400/10 border-amber-400/20',
  TERMINACION: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
}

const VIGENCY_BORDER: Record<VigencyStatus, string> = {
  vigente:     'border-l-2 border-l-emerald-500/60',
  por_vencer:  'border-l-2 border-l-amber-500/70',
  vencido:     'border-l-2 border-l-border',
  indefinido:  'border-l-2 border-l-sky-500/50',
  no_iniciado: 'border-l-2 border-l-border',
  en_licencia: 'border-l-2 border-l-violet-500/60',
}

// Vigency statuses that start expanded — the rest start collapsed
const EXPANDED_STATUSES = new Set<VigencyStatus>(['vigente', 'por_vencer', 'indefinido', 'en_licencia'])

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  // T12:00:00Z avoids off-by-one when the local timezone is behind UTC
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function buildDateRange(group: CaseGroup): string {
  const start = fmtDate(group.docs.find((d) => d.document_type === 'INICIAL')?.fecha_inicio)
  if (!start) return ''
  const end = fmtDate(group.endDate)
  return end ? `${start} → ${end}` : `${start} →`
}

// ── Sub-components ─────────────────────────────────────────────────────────

function VigencyBadge({ status, daysLeft }: { status: VigencyStatus; daysLeft: number | null }) {
  if (status === 'vigente') return (
    <span className="hidden sm:inline-flex items-center gap-1 font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
      Vigente{daysLeft !== null ? ` · ${daysLeft} día${daysLeft !== 1 ? 's' : ''}` : ''}
    </span>
  )
  if (status === 'indefinido') return (
    <span className="hidden sm:inline-flex items-center gap-1 font-mono text-xs text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-full px-2 py-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-sky-400 inline-block" />
      Indefinido
    </span>
  )
  if (status === 'por_vencer') return (
    <span className="hidden sm:inline-flex items-center gap-1 font-mono text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
      <CalendarClock className="h-3 w-3" />
      Vence en {daysLeft} día{daysLeft !== 1 ? 's' : ''}
    </span>
  )
  if (status === 'vencido') return (
    <span className="hidden sm:inline-flex items-center gap-1 font-mono text-xs text-muted-foreground bg-muted/30 border border-border rounded-full px-2 py-0.5">
      Vencido
    </span>
  )
  if (status === 'en_licencia') return (
    <span className="hidden sm:inline-flex items-center gap-1 font-mono text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-violet-400 inline-block" />
      En licencia
    </span>
  )
  return null
}

// ── Main component ─────────────────────────────────────────────────────────

interface ContractsListProps {
  cases: CaseGroup[]
  totalDocs: number
  role: string | null
}

export default function ContractsList({ cases, totalDocs, role }: ContractsListProps) {
  const [search, setSearch] = useState('')
  const [vigencyFilter, setVigencyFilter] = useState<VigencyStatus | ''>('')
  const [pendingOnly, setPendingOnly] = useState(false)

  // ── Expand/collapse state ─────────────────────────────────────────────────

  const [expandedCases, setExpandedCases] = useState<Set<string>>(
    () => new Set(cases.filter((c) => EXPANDED_STATUSES.has(c.vigency)).map((c) => c.caseId))
  )

  const toggleCase = useCallback((id: string) => {
    setExpandedCases((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }, [])

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    return cases.filter((g) => {
      if (term && !g.employeeName.toLowerCase().includes(term)) return false
      if (vigencyFilter && g.vigency !== vigencyFilter) return false
      if (pendingOnly && !g.docs.some((d) => d.estado === 'generated')) return false
      return true
    })
  }, [cases, search, vigencyFilter, pendingOnly])

  const allExpanded = filtered.length > 0 && filtered.every((c) => expandedCases.has(c.caseId))

  const toggleAll = useCallback(() => {
    setExpandedCases(allExpanded ? new Set() : new Set(filtered.map((c) => c.caseId)))
  }, [allExpanded, filtered])

  // Auto-expand filtered results when any filter is active.
  // filtered is memoized, so its reference only changes when cases/search/filter change —
  // including it in deps is safe and avoids the exhaustive-deps warning.
  useEffect(() => {
    if (search || vigencyFilter || pendingOnly) {
      setExpandedCases((prev) => new Set([...prev, ...filtered.map((c) => c.caseId)]))
    }
  }, [search, vigencyFilter, pendingOnly, filtered])

  // ── Derived stats ─────────────────────────────────────────────────────────

  const vigentes   = cases.filter((c) => c.vigency === 'vigente' || c.vigency === 'indefinido' || c.vigency === 'por_vencer' || c.vigency === 'en_licencia').length
  const porVencer  = cases.filter((c) => c.vigency === 'por_vencer').length
  const pendientes = cases.filter((c) => c.docs.some((d) => d.estado === 'generated')).length

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {[
          { label: 'Expedientes', value: cases.length, color: '' },
          { label: 'Vigentes', value: vigentes, color: 'text-emerald-400' },
          { label: 'Por vencer', value: porVencer, color: 'text-amber-400' },
          { label: 'Pend. firma', value: pendientes, color: 'text-amber-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-mono font-semibold mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Buscar empleado…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={vigencyFilter}
          onChange={(e) => setVigencyFilter(e.target.value as VigencyStatus | '')}
          className="rounded-md border border-border bg-transparent px-3 py-1.5 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Todos</option>
          <option value="vigente">Vigentes</option>
          <option value="por_vencer">Por vencer</option>
          <option value="indefinido">Indefinidos</option>
          <option value="en_licencia">En licencia</option>
          <option value="vencido">Vencidos</option>
        </select>
        <button
          onClick={() => setPendingOnly((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
            pendingOnly
              ? 'border-amber-400/40 text-amber-400 bg-amber-400/10'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/30'
          }`}
        >
          {pendingOnly ? 'Pendientes de firma' : 'Pendientes de firma'}
          {pendientes > 0 && !pendingOnly && ` (${pendientes})`}
        </button>
        {(search || vigencyFilter || pendingOnly) && (
          <button
            onClick={() => { setSearch(''); setVigencyFilter(''); setPendingOnly(false) }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpiar
          </button>
        )}
        <button
          onClick={toggleAll}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 hover:bg-muted/30 transition-colors shrink-0"
        >
          {allExpanded ? 'Colapsar todo' : 'Expandir todo'}
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {search || vigencyFilter || pendingOnly ? 'Sin resultados para ese filtro.' : 'No hay contratos registrados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((group) => (
            <CaseCard
              key={group.caseId}
              group={group}
              role={role}
              expanded={expandedCases.has(group.caseId)}
              onToggle={() => toggleCase(group.caseId)}
            />
          ))}
          {filtered.length < cases.length && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              Mostrando {filtered.length} de {cases.length} expedientes
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── CaseCard ──────────────────────────────────────────────────────────────

function CaseCard({
  group,
  role,
  expanded,
  onToggle,
}: {
  group: CaseGroup
  role: string | null
  expanded: boolean
  onToggle: () => void
}) {
  const anyPending = group.docs.some((d) => d.estado === 'generated')
  const isExpired  = group.vigency === 'vencido'
  const dateRange  = buildDateRange(group)

  return (
    <div className={`rounded-lg border border-border bg-card overflow-hidden ${VIGENCY_BORDER[group.vigency]}`}>
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b border-border ${isExpired ? 'bg-muted/10' : 'bg-muted/30'}`}>
        {/* Left: toggle button — chevron + identity info */}
        <button
          onClick={onToggle}
          className={`flex items-center gap-2.5 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity ${isExpired ? 'opacity-60' : ''}`}
        >
          {expanded
            ? <ChevronDown  className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          }
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-mono text-xs font-medium text-muted-foreground shrink-0">{group.caseNumber}</span>
          <span className="text-sm font-medium truncate">{group.employeeName}</span>
          {!expanded && dateRange && (
            <span className="hidden sm:inline font-mono text-xs text-muted-foreground shrink-0">
              · {dateRange}
            </span>
          )}
        </button>

        {/* Right: badges + actions — independent of toggle button */}
        <div className="flex items-center gap-2 shrink-0">
          <VigencyBadge status={group.vigency} daysLeft={group.daysLeft} />
          {anyPending && (
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
              <Clock className="h-3 w-3" />
              {group.docs.filter((d) => d.estado === 'generated').length} pendiente{group.docs.filter((d) => d.estado === 'generated').length !== 1 ? 's' : ''}
            </span>
          )}
          {!expanded && (
            <span className="hidden sm:inline-flex font-mono text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
              {group.docs.length} doc{group.docs.length !== 1 ? 's' : ''}
            </span>
          )}
          {role !== 'viewer' && group.employeeId && !isExpired && group.docs.some((d) => d.document_type === 'INICIAL') && (
            <Link
              href={`/contracts/new?employee_id=${group.employeeId}&case_id=${group.caseId}`}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 hover:bg-muted/30 transition-colors"
            >
              + Agregar
            </Link>
          )}
        </div>
      </div>

      {/* Documents — only rendered when expanded */}
      {expanded && (
        <div className={`divide-y divide-border/60 ${isExpired ? 'opacity-60' : ''}`}>
          {group.docs.map((doc, idx) => {
            const isLast = idx === group.docs.length - 1
            return (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/10 transition-colors">
                <div className="flex flex-col items-center self-stretch shrink-0 w-4">
                  <div className="w-px flex-1 bg-border/60" />
                  <div className="w-2 h-px bg-border/60" />
                  {!isLast && <div className="w-px flex-1 bg-border/60" />}
                </div>
                <span className={`shrink-0 inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-xs ${DOCTYPE_COLOR[doc.document_type] ?? 'text-muted-foreground border-border'}`}>
                  {DOCTYPE_LABEL[doc.document_type] ?? doc.document_type}
                </span>
                <span className="font-mono text-xs text-muted-foreground shrink-0 hidden sm:block">
                  {doc.fecha_inicio ?? '—'}
                </span>
                <span className="flex-1" />
                {doc.estado === 'signed' ? (
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-400">
                    <CheckSquare className="h-3 w-3" /><span className="hidden sm:inline">Firmado</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-amber-400">
                    <Clock className="h-3 w-3" /><span className="hidden sm:inline">Pendiente</span>
                  </span>
                )}
                <Link href={`/contracts/${doc.id}`} className="text-xs text-muted-foreground hover:text-primary transition-colors ml-2">
                  Ver →
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
