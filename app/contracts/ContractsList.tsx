'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { FileText, CheckSquare, Clock, GitBranch, CalendarClock, ChevronDown, ChevronRight, Pen, AlertTriangle } from 'lucide-react'

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
    firma_trabajador: string | null
    firma_representante: string | null
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
  vencido:     'border-l-2 border-l-rose-500/80',
  indefinido:  'border-l-2 border-l-sky-500/50',
  no_iniciado: 'border-l-2 border-l-border',
  en_licencia: 'border-l-2 border-l-violet-500/60',
}

// Within-year sort: expired first (alert), then por_vencer, then the rest
const URGENCY_ORDER: Record<VigencyStatus, number> = {
  vencido: 0, por_vencer: 1, vigente: 2, en_licencia: 3, indefinido: 4, no_iniciado: 5,
}

// These statuses start with their case card expanded
const EXPANDED_STATUSES = new Set<VigencyStatus>(['vigente', 'por_vencer', 'indefinido', 'en_licencia'])

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
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

function caseYear(caseNumber: string): string {
  return caseNumber.split('-')[0] ?? '—'
}

// ── VigencyBadge ──────────────────────────────────────────────────────────

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
    <span className="hidden sm:inline-flex items-center gap-1 font-mono text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-full px-2 py-0.5">
      <AlertTriangle className="h-3 w-3" />
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

// ── YearGroup ─────────────────────────────────────────────────────────────

function YearGroup({
  year,
  cases,
  role,
  isOpen,
  onToggle,
  expandedCases,
  onToggleCase,
}: {
  year: string
  cases: CaseGroup[]
  role: string | null
  isOpen: boolean
  onToggle: () => void
  expandedCases: Set<string>
  onToggleCase: (id: string) => void
}) {
  const vencidos  = cases.filter((c) => c.vigency === 'vencido').length
  const porVencer = cases.filter((c) => c.vigency === 'por_vencer').length

  return (
    <div className="space-y-2">
      {/* Year header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
          />
          <span className="font-mono text-sm font-semibold">Contratos {year}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {cases.length} expediente{cases.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {vencidos > 0 && (
            <span className="inline-flex items-center gap-1 font-mono text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-full px-2 py-0.5">
              <AlertTriangle className="h-3 w-3" />
              {vencidos} vencido{vencidos !== 1 ? 's' : ''}
            </span>
          )}
          {porVencer > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
              <CalendarClock className="h-3 w-3" />
              {porVencer} por vencer
            </span>
          )}
        </div>
      </button>

      {/* Cases */}
      {isOpen && (
        <div className="space-y-2 pl-1">
          {cases.map((group) => (
            <CaseCard
              key={group.caseId}
              group={group}
              role={role}
              expanded={expandedCases.has(group.caseId)}
              onToggle={() => onToggleCase(group.caseId)}
            />
          ))}
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
    <div className={`rounded-lg border overflow-hidden ${VIGENCY_BORDER[group.vigency]} ${
      isExpired ? 'border-rose-500/40 bg-card' : 'border-border bg-card'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${
        isExpired ? 'border-rose-500/20 bg-muted/30' : 'border-border bg-muted/30'
      }`}>
        <button
          onClick={onToggle}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
        >
          {expanded
            ? <ChevronDown  className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          }
          <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="font-mono text-xs font-medium shrink-0 text-muted-foreground">
            {group.caseNumber}
          </span>
          <span className="text-sm font-medium truncate">
            {group.employeeName}
          </span>
          {!expanded && dateRange && (
            <span className="hidden sm:inline font-mono text-xs text-muted-foreground shrink-0">
              · {dateRange}
            </span>
          )}
        </button>

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

      {/* Documents */}
      {expanded && (
        <div className="divide-y divide-border/60">
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
                {doc.estado === 'signed' && doc.firma_trabajador && !doc.firma_representante && (role === 'supervisor' || role === 'admin') && (
                  <span className="hidden sm:inline-flex items-center gap-1 font-mono text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5">
                    <Pen className="h-3 w-3" />Falta firma rep.
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
  const [repPendingOnly, setRepPendingOnly] = useState(false)

  const currentYear = new Date().getFullYear().toString()

  // ── Case-level expand/collapse ────────────────────────────────────────
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

  // ── Year-level expand/collapse ────────────────────────────────────────
  const [expandedYears, setExpandedYears] = useState<Set<string>>(() => new Set())

  const toggleYear = useCallback((year: string) => {
    setExpandedYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) { next.delete(year) } else { next.add(year) }
      return next
    })
  }, [])

  // ── Year groups: filter → group by year → sort within year ────────────
  const yearGroups = useMemo(() => {
    const term = search.toLowerCase().trim()
    const filtered = cases.filter((g) => {
      if (term && !g.employeeName.toLowerCase().includes(term)) return false
      if (vigencyFilter && g.vigency !== vigencyFilter) return false
      if (pendingOnly && !g.docs.some((d) => d.estado === 'generated')) return false
      if (repPendingOnly && !g.docs.some((d) => d.firma_trabajador && !d.firma_representante)) return false
      return true
    })

    const byYear = new Map<string, CaseGroup[]>()
    for (const c of filtered) {
      const year = caseYear(c.caseNumber)
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year)!.push(c)
    }

    for (const yearCases of byYear.values()) {
      yearCases.sort((a, b) => {
        const ud = URGENCY_ORDER[a.vigency] - URGENCY_ORDER[b.vigency]
        if (ud !== 0) return ud
        // Within same status: soonest expiry first, then newest case number
        if (a.daysLeft !== null && b.daysLeft !== null) return a.daysLeft - b.daysLeft
        return b.caseNumber.localeCompare(a.caseNumber)
      })
    }

    return Array.from(byYear.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [cases, search, vigencyFilter, pendingOnly, repPendingOnly])

  const filteredCount = yearGroups.reduce((sum, [, c]) => sum + c.length, 0)
  const anyFilter = !!(search || vigencyFilter || pendingOnly || repPendingOnly)

  // When a filter is active: auto-expand matching year groups and cases
  useEffect(() => {
    if (anyFilter) {
      const allFiltered = yearGroups.flatMap(([, c]) => c)
      setExpandedCases((prev) => new Set([...prev, ...allFiltered.map((c) => c.caseId)]))
      setExpandedYears((prev) => new Set([...prev, ...yearGroups.map(([y]) => y)]))
    }
  }, [anyFilter, yearGroups])

  const allYearsExpanded = yearGroups.length > 0 && yearGroups.every(([y]) => expandedYears.has(y))

  const toggleAllYears = useCallback(() => {
    setExpandedYears(allYearsExpanded ? new Set() : new Set(yearGroups.map(([y]) => y)))
  }, [allYearsExpanded, yearGroups])

  // ── Derived stats ─────────────────────────────────────────────────────
  const vigentes   = cases.filter((c) => ['vigente', 'indefinido', 'por_vencer', 'en_licencia'].includes(c.vigency)).length
  const porVencer  = cases.filter((c) => c.vigency === 'por_vencer').length
  const vencidos   = cases.filter((c) => c.vigency === 'vencido').length
  const pendientes = cases.filter((c) => c.docs.some((d) => d.estado === 'generated')).length

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {[
          { label: 'Expedientes', value: cases.length,  color: '' },
          { label: 'Vigentes',    value: vigentes,       color: 'text-emerald-400' },
          { label: 'Por vencer',  value: porVencer,      color: 'text-amber-400' },
          { label: 'Pend. firma', value: pendientes,     color: 'text-amber-400' },
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
          Pend. firma{pendientes > 0 && !pendingOnly ? ` (${pendientes})` : ''}
        </button>
        {(role === 'supervisor' || role === 'admin') && (
          <button
            onClick={() => setRepPendingOnly((v) => !v)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              repPendingOnly
                ? 'border-indigo-400/40 text-indigo-400 bg-indigo-400/10'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
          >
            Falta firma rep.
          </button>
        )}
        {vencidos > 0 && (
          <button
            onClick={() => setVigencyFilter((v) => v === 'vencido' ? '' : 'vencido')}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
              vigencyFilter === 'vencido'
                ? 'border-rose-400/40 text-rose-400 bg-rose-400/10'
                : 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Vencidos ({vencidos})
          </button>
        )}
        {anyFilter && (
          <button
            onClick={() => { setSearch(''); setVigencyFilter(''); setPendingOnly(false); setRepPendingOnly(false) }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpiar
          </button>
        )}
        <button
          onClick={toggleAllYears}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 hover:bg-muted/30 transition-colors shrink-0"
        >
          {allYearsExpanded ? 'Colapsar todo' : 'Expandir todo'}
        </button>
      </div>

      {/* Year groups */}
      {yearGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {anyFilter ? 'Sin resultados para ese filtro.' : 'No hay contratos registrados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {yearGroups.map(([year, yearCases]) => (
            <YearGroup
              key={year}
              year={year}
              cases={yearCases}
              role={role}
              isOpen={expandedYears.has(year)}
              onToggle={() => toggleYear(year)}
              expandedCases={expandedCases}
              onToggleCase={toggleCase}
            />
          ))}
          {filteredCount < cases.length && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              Mostrando {filteredCount} de {cases.length} expedientes
            </p>
          )}
        </div>
      )}
    </div>
  )
}
