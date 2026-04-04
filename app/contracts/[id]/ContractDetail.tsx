'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckSquare, Clock, ShieldCheck, ShieldAlert, Trash2, Upload, PenLine, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/client'
import {
  attachSignedPdfAction,
  deleteContractAction,
  getAppSettings,
} from '@/app/contracts/actions/contracts'
import { verifyContractIntegrity } from '@/app/contracts/actions/verify-integrity'
import type { ContractWithEmployee, ContractAuditLog } from '@/app/contracts/types'
import type { Employee } from '@/app/(shared)/lib/employee-types'
import { hashData } from '@/app/contracts/lib/security'
import SignatureModal from './SignatureModal'

interface Props {
  contract: ContractWithEmployee
  auditLogs: ContractAuditLog[]
  employee: Employee | null
  role: 'admin' | 'coordinator' | 'viewer' | null
}

const STORAGE_BUCKET = 'contracts'
const labelClass = "text-xs font-medium uppercase tracking-wide text-muted-foreground"
const btnSecondary = "rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"

export default function ContractDetail({ contract, auditLogs, employee, role }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [justSigned, setJustSigned] = useState(false)

  const [openingPdf, setOpeningPdf] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [integrityResult, setIntegrityResult] = useState<{
    match: boolean
    storedHash: string | null
    computedHash: string | null
    reason?: string
  } | null>(null)

  async function handlePdfUpload(file: File) {
    setUploadError(null)
    setUploading(true)
    try {
      const buffer = await file.arrayBuffer()
      const hash = await hashData(buffer)
      const pdfPath = `pdf/${contract.contract_number ?? contract.id}_${Date.now()}.pdf`
      const supabase = createClient()
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(pdfPath, file, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw new Error(`Error al subir el PDF: ${upErr.message}`)
      await attachSignedPdfAction(contract.id, pdfPath, file.name, hash)
      router.refresh()
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Error desconocido.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSignatureConfirmed(signatureDataUrl: string) {
    if (!employee) return
    setShowSignatureModal(false)
    setSigning(true)
    setSignError(null)
    try {
      const [{ generateContractPdf }, { buildContractVars }, settings] = await Promise.all([
        import('@/app/contracts/lib/contract-pdf'),
        import('@/app/contracts/lib/pdf-vars'),
        getAppSettings(),
      ])

      const baseVars = buildContractVars(employee, {
        numeroContrato: contract.contract_number ?? '',
        fechaInicio: contract.fecha_inicio ?? '',
        fechaTerminacion: contract.fecha_terminacion ?? undefined,
        lugarTrabajo: settings.lugarTrabajo,
      })
      const vars = { ...baseVars, firma: signatureDataUrl }

      const pdfBlob = await generateContractPdf(vars, contract.tipo_contrato ?? '')
      const buffer = await pdfBlob.arrayBuffer()
      const hash = await hashData(buffer)

      const filename = `contrato_${contract.contract_number}_firmado.pdf`
      const pdfPath = `pdf/${contract.contract_number ?? contract.id}_signed.pdf`
      const supabase = createClient()
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw new Error(`Error al subir el PDF: ${upErr.message}`)

      await attachSignedPdfAction(contract.id, pdfPath, filename, hash)

      // Show success banner before refresh — on mobile this is the only
      // feedback since the download is skipped.
      setJustSigned(true)

      // Trigger browser download — desktop only.
      // On iOS Safari, a.click() on a blob URL navigates the current page,
      // causing "Load Failed" and killing attachSignedPdfAction before it runs.
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      if (!isMobile) {
        try {
          const url = URL.createObjectURL(pdfBlob)
          const a = document.createElement('a')
          a.href = url
          a.download = filename
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch {
          // ignore — contract is already signed and saved
        }
      }

      router.refresh()
    } catch (e) {
      setSignError(e instanceof Error ? e.message : 'Error al generar el contrato firmado.')
    } finally {
      setSigning(false)
    }
  }

  async function handleOpenPdf() {
    if (!contract.pdf_path) return
    setOpeningPdf(true)
    // Open the window synchronously while still inside the click-handler's
    // user-gesture context. iOS Safari blocks window.open() called after
    // any await, treating it as an unsolicited popup.
    const newWindow = window.open('', '_blank', 'noopener')
    try {
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(contract.pdf_path, 3600)
      if (error || !data) throw new Error('No se pudo generar el enlace.')
      if (newWindow) {
        newWindow.location.href = data.signedUrl
      } else {
        // Popup was blocked — fall back to same-tab navigation
        window.location.href = data.signedUrl
      }
    } catch (e) {
      newWindow?.close()
      console.error(e)
    } finally {
      setOpeningPdf(false)
    }
  }

  async function handleVerifyIntegrity() {
    setVerifying(true)
    setIntegrityResult(null)
    const result = await verifyContractIntegrity(contract.id)
    setIntegrityResult(result)
    setVerifying(false)
  }

  function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    startTransition(async () => {
      await deleteContractAction(contract.id)
    })
  }

  const isSignedState = contract.estado === 'signed'

  return (
    <>
      {showSignatureModal && (
        <SignatureModal
          workerName={contract.employees?.full_name ?? ''}
          onConfirm={handleSignatureConfirmed}
          onClose={() => setShowSignatureModal(false)}
        />
      )}

      <div className="px-4 py-6 sm:px-6 max-w-3xl mx-auto space-y-8">

        {/* Success banner — shown after signing completes, before router.refresh() resolves */}
        {justSigned && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 flex items-start gap-3">
            <CheckSquare className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-emerald-400">Contrato firmado exitosamente</p>
              <p className="text-xs text-emerald-400/80">
                El PDF firmado fue guardado. Puedes verlo en la sección de abajo.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight">
                {contract.employees?.full_name ?? '—'}
              </h1>
              {isSignedState ? (
                <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-emerald-500 border border-emerald-500/20 bg-emerald-500/10 rounded-full px-2.5 py-0.5">
                  <CheckSquare className="h-3 w-3" /> Firmado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-amber-500 border border-amber-500/20 bg-amber-500/10 rounded-full px-2.5 py-0.5">
                  <Clock className="h-3 w-3" /> Pendiente
                </span>
              )}
            </div>
            <p className="font-mono text-sm text-muted-foreground">{contract.contract_number ?? '—'}</p>
          </div>
        </div>

        {/* Contract info */}
        <div className="rounded-lg border border-border divide-y divide-border/60">
          <Row label="Tipo de contrato" value={contract.tipo_contrato} />
          <Row label="Fecha de inicio" value={contract.fecha_inicio} mono />
          <Row label="Fecha de terminación" value={contract.fecha_terminacion} mono />
          <Row label="Forma de pago" value={contract.forma_pago} />
          <Row
            label="Generado"
            value={new Date(contract.generated_at).toLocaleString('es-CO', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            mono
          />
          {contract.signed_at && (
            <Row
              label="Firmado"
              value={new Date(contract.signed_at).toLocaleString('es-CO', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
              mono
            />
          )}
        </div>

        {/* Signature capture */}
        {!isSignedState && employee && (
          <section className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h2 className={labelClass}>Firma presencial</h2>
            <p className="text-sm text-muted-foreground">
              Abre el panel de firma, pídele al empleado que firme con el lápiz digital,
              y el sistema generará automáticamente el PDF firmado.
            </p>
            {signError && (
              <p className="font-mono text-xs text-destructive bg-destructive/10 rounded px-3 py-1.5">
                {signError}
              </p>
            )}
            <button
              onClick={() => setShowSignatureModal(true)}
              disabled={signing}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <PenLine className="h-4 w-4" />
              {signing ? 'Generando PDF firmado…' : 'Capturar firma del trabajador'}
            </button>
          </section>
        )}

        {/* PDF section — only shown once the contract has been signed or a PDF already exists */}
        {(isSignedState || !!contract.pdf_path) && (
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className={labelClass}>PDF firmado</h2>

          {contract.pdf_path ? (
            <div className="space-y-4">
              {/* Filename + actions row */}
              <div className="flex items-center gap-3 flex-wrap">
                <p className="font-mono text-sm text-muted-foreground flex-1 min-w-0 truncate">
                  {contract.pdf_filename ?? contract.pdf_path}
                </p>
                <button
                  onClick={handleOpenPdf}
                  disabled={openingPdf}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {openingPdf ? 'Abriendo…' : 'Ver PDF'}
                </button>
              </div>

              {/* Integrity */}
              <div className="space-y-2">
                <button
                  onClick={handleVerifyIntegrity}
                  disabled={verifying}
                  className={`inline-flex items-center gap-1.5 ${btnSecondary} text-xs py-1.5`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {verifying ? 'Verificando…' : 'Verificar integridad'}
                </button>
                {integrityResult && (
                  <div className={`rounded-md px-3 py-2 text-xs border ${
                    integrityResult.match
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    <div className="flex items-center gap-1.5 font-medium">
                      {integrityResult.match ? (
                        <><ShieldCheck className="h-3.5 w-3.5" /> Integridad verificada — el archivo no ha sido modificado</>
                      ) : (
                        <><ShieldAlert className="h-3.5 w-3.5" /> {integrityResult.reason ?? 'El archivo ha sido modificado o no coincide con el original'}</>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Replace — collapsible feel via details */}
              <details className="group">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-1">
                  <span className="group-open:hidden">▸ Reemplazar PDF firmado</span>
                  <span className="hidden group-open:inline">▾ Reemplazar PDF firmado</span>
                </summary>
                <div className="mt-3">
                  <PdfUploadArea uploading={uploading} uploadError={uploadError} fileInputRef={fileInputRef} onFile={handlePdfUpload} />
                </div>
              </details>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Ningún PDF cargado aún.</p>
              <PdfUploadArea uploading={uploading} uploadError={uploadError} fileInputRef={fileInputRef} onFile={handlePdfUpload} />
            </div>
          )}
        </section>
        )}

        {/* Audit log */}
        {auditLogs.length > 0 && (
          <section className="space-y-3">
            <h2 className={labelClass}>Historial de cambios</h2>
            <div className="rounded-lg border border-border divide-y divide-border/60">
              {auditLogs.map((log) => (
                <div key={log.id} className="px-4 py-3 flex gap-4 text-sm">
                  <span className="font-mono text-xs text-muted-foreground w-32 shrink-0 pt-0.5">
                    {new Date(log.created_at).toLocaleString('es-CO', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium capitalize">{log.action}</span>
                    {log.user_email && (
                      <span className="text-muted-foreground"> · {log.user_email}</span>
                    )}
                    {Object.keys(log.details).length > 0 && (
                      <p className="font-mono text-xs text-muted-foreground/70 truncate mt-0.5">
                        {JSON.stringify(log.details)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/contracts" className={btnSecondary}>← Volver</Link>
          {role === 'admin' && (
            <>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 ${
                  deleteConfirm
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleteConfirm
                  ? isSignedState
                    ? '¿Eliminar contrato firmado? Esto es irreversible'
                    : 'Confirmar eliminación'
                  : 'Eliminar'}
              </button>
              {deleteConfirm && (
                <button onClick={() => setDeleteConfirm(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cancelar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Row({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center px-4 py-3 text-sm gap-0.5 sm:gap-6">
      <span className="sm:w-44 sm:shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono text-xs sm:text-sm' : ''}>{value ?? '—'}</span>
    </div>
  )
}

function PdfUploadArea({
  uploading,
  uploadError,
  fileInputRef,
  onFile,
}: {
  uploading: boolean
  uploadError: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFile: (file: File) => void
}) {
  return (
    <div className="space-y-2">
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border px-6 py-8 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file?.type === 'application/pdf') onFile(file)
        }}
      >
        <div className="text-center space-y-1.5">
          <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {uploading ? 'Subiendo…' : 'Arrastra un PDF aquí o haz clic para seleccionar'}
          </p>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
      {uploadError && (
        <p className="font-mono text-xs text-destructive bg-destructive/10 rounded px-3 py-1.5">{uploadError}</p>
      )}
    </div>
  )
}
