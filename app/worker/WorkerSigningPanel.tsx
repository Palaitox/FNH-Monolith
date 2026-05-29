'use client'

import { useState } from 'react'
import { CheckSquare, Clock, FileText } from 'lucide-react'
import SignatureModal from '@/app/contracts/[id]/SignatureModal'
import { workerSignContractAction } from './actions'
import type { AppSettings } from '@/app/contracts/types'

interface ContractDoc {
  id: string
  case_id: string
  document_type: string
  tipo_contrato: string | null
  fecha_inicio: string | null
  fecha_terminacion: string | null
  estado: string
  pdf_path: string | null
  signed_at: string | null
  contract_cases: { case_number: string } | null
}

interface Employee {
  id: string
  full_name: string
  cedula: string
  ciudad_cedula: string | null
  cargo: string | null
  telefono: string | null
  correo: string | null
  salario_base: number | null
  auxilio_transporte: number
  jornada_laboral: string
}

interface Props {
  employee: Employee
  documents: ContractDoc[]
  settings: AppSettings
}

const DOCTYPE_LABEL: Record<string, string> = {
  INICIAL:            'Contrato inicial',
  PRORROGA:           'Prórroga',
  OTRO_SI:            'Otro Sí — Fecha de pago',
  OTRO_SI_AMPLIACION: 'Otro Sí — Ampliación',
  TERMINACION:        'Terminación',
}

export default function WorkerSigningPanel({ employee, documents, settings }: Props) {
  const [signingDocId, setSigningDocId] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [justSignedIds, setJustSignedIds] = useState<Set<string>>(new Set())

  const pendingDocs = documents.filter((d) => d.estado === 'generated')
  const signedDocs = documents.filter((d) => d.estado === 'signed')

  async function handleSignatureConfirmed(signatureDataUrl: string) {
    if (!signingDocId) return
    const doc = documents.find((d) => d.id === signingDocId)
    if (!doc) return

    setSignError(null)
    setSigning(true)
    setSigningDocId(null)

    try {
      const [{ generateContractPdf }, { buildContractVars }] = await Promise.all([
        import('@/app/contracts/lib/contract-pdf'),
        import('@/app/contracts/lib/pdf-vars'),
      ])

      const caseNumber = doc.contract_cases?.case_number ?? ''

      const vars = buildContractVars(employee as Parameters<typeof buildContractVars>[0], {
        numeroContrato: caseNumber,
        fechaInicio: doc.fecha_inicio ?? '',
        fechaTerminacion: doc.fecha_terminacion ?? undefined,
        lugarTrabajo: settings.lugarTrabajo,
      })

      const tipoForPdf = doc.document_type === 'INICIAL'
        ? (doc.tipo_contrato ?? '')
        : doc.document_type.toLowerCase()

      const pdfBlob = await generateContractPdf(
        { ...vars, firma: signatureDataUrl },
        tipoForPdf,
      )

      // Convert blob to base64 for server action (avoids storage RLS)
      const buffer = await pdfBlob.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      bytes.forEach((b) => { binary += String.fromCharCode(b) })
      const pdfBase64 = btoa(binary)

      const result = await workerSignContractAction(signingDocId, pdfBase64, signatureDataUrl)

      if ('error' in result) {
        setSignError(result.error)
      } else {
        setJustSignedIds((prev) => new Set([...prev, signingDocId]))
      }
    } catch (e) {
      setSignError(e instanceof Error ? e.message : 'Error al generar el PDF.')
    } finally {
      setSigning(false)
    }
  }

  return (
    <>
      {signingDocId && (
        <SignatureModal
          workerName={employee.full_name}
          onConfirm={handleSignatureConfirmed}
          onClose={() => setSigningDocId(null)}
        />
      )}

      <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Mis contratos</h1>
            <p className="text-sm text-muted-foreground">
              {employee.full_name} — C.C. {employee.cedula}
            </p>
          </div>

          {signError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-4 py-3">
              {signError}
            </p>
          )}

          {signing && (
            <p className="text-sm text-muted-foreground animate-pulse">
              Generando PDF firmado…
            </p>
          )}

          {/* Pending signatures */}
          {pendingDocs.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pendientes de firma
              </h2>
              <div className="rounded-lg border border-amber-500/20 divide-y divide-border/60">
                {pendingDocs.map((doc) => {
                  const caseNumber = doc.contract_cases?.case_number ?? '—'
                  const justSigned = justSignedIds.has(doc.id)
                  return (
                    <div key={doc.id} className="p-4 flex items-center justify-between gap-4">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">
                            {DOCTYPE_LABEL[doc.document_type] ?? doc.document_type}
                          </span>
                          {justSigned ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 rounded-full px-2 py-0.5">
                              <CheckSquare className="h-3 w-3" /> Firmado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-400 border border-amber-500/20 bg-amber-500/10 rounded-full px-2 py-0.5">
                              <Clock className="h-3 w-3" /> Pendiente
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-xs text-muted-foreground pl-6">
                          {caseNumber}
                          {doc.fecha_inicio && ` · Inicio ${doc.fecha_inicio}`}
                          {doc.fecha_terminacion && ` · Fin ${doc.fecha_terminacion}`}
                        </p>
                      </div>
                      {!justSigned && (
                        <button
                          disabled={signing}
                          onClick={() => setSigningDocId(doc.id)}
                          className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          Firmar
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Signed */}
          {signedDocs.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Contratos firmados
              </h2>
              <div className="rounded-lg border border-border divide-y divide-border/60">
                {signedDocs.map((doc) => {
                  const caseNumber = doc.contract_cases?.case_number ?? '—'
                  return (
                    <div key={doc.id} className="p-4 flex items-center gap-3">
                      <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {DOCTYPE_LABEL[doc.document_type] ?? doc.document_type}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {caseNumber}
                          {doc.signed_at && ` · Firmado ${new Date(doc.signed_at).toLocaleDateString('es-CO')}`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {pendingDocs.length === 0 && signedDocs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No tienes contratos registrados en el sistema.
            </p>
          )}

          {pendingDocs.length === 0 && signedDocs.length > 0 && (
            <p className="text-sm text-muted-foreground bg-emerald-500/5 border border-emerald-500/20 rounded-md px-4 py-3">
              Todos tus contratos han sido firmados. Gracias.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
