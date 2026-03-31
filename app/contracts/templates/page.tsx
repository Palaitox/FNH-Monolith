'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/client'
import {
  listTemplates,
  uploadTemplateAction,
  deleteTemplateAction,
} from '@/app/contracts/actions/contracts'
import type { ContractTemplate } from '@/app/contracts/types'

const labelClass = 'text-xs font-medium uppercase tracking-wide text-muted-foreground'
const btnPrimary =
  'rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors'
const btnSecondary =
  'rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors'

const STORAGE_BUCKET = 'contracts'

export default function TemplatesPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(null)
  const [isDeleting, startDeleting] = useTransition()

  async function reload() {
    setLoading(true)
    const data = await listTemplates()
    setTemplates(data)
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    if (file && !nameInput) {
      // Pre-fill name from filename (strip extension)
      setNameInput(file.name.replace(/\.(docx?|xlsx?)$/i, ''))
    }
  }

  async function handleUpload() {
    if (!selectedFile || !nameInput.trim()) return
    setUploadError(null)
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = selectedFile.name.split('.').pop() ?? 'docx'
      const storagePath = `templates/${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, selectedFile, {
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: false,
        })

      if (upErr) throw new Error(`Error al subir: ${upErr.message}`)

      await uploadTemplateAction(nameInput.trim(), storagePath)
      setNameInput('')
      setSelectedFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await reload()
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Error desconocido.')
    } finally {
      setUploading(false)
    }
  }

  function handleDelete(template: ContractTemplate) {
    setDeleteTarget(template)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    startDeleting(async () => {
      await deleteTemplateAction(target.id, target.storage_path)
      await reload()
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Plantillas de contratos</h1>
          <p className="text-sm text-muted-foreground">
            Archivos .docx usados para generar contratos con docxtemplater.
          </p>
        </div>
        <Link href="/contracts" className={btnSecondary}>
          Volver
        </Link>
      </div>

      {/* Upload form */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <p className={labelClass}>Subir nueva plantilla</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelClass}>Nombre</label>
            <input
              type="text"
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
              placeholder="Ej: Contrato prestación de servicios"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Archivo (.docx)</label>
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex-1 rounded-md border border-border bg-card px-3 py-2.5 text-sm text-left text-muted-foreground hover:bg-muted/30 transition-colors truncate"
              >
                {selectedFile ? selectedFile.name : 'Seleccionar archivo…'}
              </button>
            </div>
          </div>
        </div>
        {uploadError && (
          <p className="font-mono text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
            {uploadError}
          </p>
        )}
        <button
          onClick={handleUpload}
          disabled={uploading || !selectedFile || !nameInput.trim()}
          className={btnPrimary}
        >
          {uploading ? 'Subiendo…' : 'Subir plantilla'}
        </button>
      </div>

      {/* Template list */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Cargando…</p>
        ) : templates.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">
            No hay plantillas registradas.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                <th className="px-4 py-2.5 text-left">Nombre</th>
                <th className="px-4 py-2.5 text-left">Ruta</th>
                <th className="px-4 py-2.5 text-left">Creada</th>
                <th className="px-4 py-2.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-xs">
                    {t.storage_path}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(t)}
                      disabled={isDeleting}
                      className="text-xs text-destructive/70 hover:text-destructive transition-colors font-medium"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-lg border border-border bg-card p-6 max-w-sm w-full mx-4 space-y-4 shadow-xl">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Eliminar plantilla</h2>
              <p className="text-sm text-muted-foreground">
                ¿Eliminar{' '}
                <span className="font-medium text-foreground">{deleteTarget.name}</span>? Esta
                acción también borrará el archivo del almacenamiento.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className={btnSecondary}>
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
