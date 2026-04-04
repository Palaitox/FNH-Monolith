'use client'

import { useEffect, useRef, useState } from 'react'
import { X, RotateCcw, Check } from 'lucide-react'

interface Props {
  workerName: string
  onConfirm: (signatureDataUrl: string) => void
  onClose: () => void
}

export default function SignatureModal({ workerName, onConfirm, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<import('signature_pad').default | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let pad: import('signature_pad').default

    function resizeCanvas() {
      if (!canvas || !pad) return
      // Preserve stroke data so iOS browser-chrome resize events don't wipe
      // the signature mid-session (toolbar animation fires window.resize).
      const savedData = pad.toData()
      const ratio = Math.max(window.devicePixelRatio ?? 1, 1)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      const ctx = canvas.getContext('2d')
      ctx?.scale(ratio, ratio)
      pad.clear()
      if (savedData.length > 0) {
        pad.fromData(savedData)
        setIsEmpty(false)
      } else {
        setIsEmpty(true)
      }
    }

    import('signature_pad').then(({ default: SignaturePad }) => {
      pad = new SignaturePad(canvas, {
        backgroundColor: 'rgba(255,255,255,0)',
        penColor: 'rgb(15,23,42)',
        minWidth: 1,
        maxWidth: 3,
      })
      padRef.current = pad
      pad.addEventListener('endStroke', () => setIsEmpty(pad.isEmpty()))
      resizeCanvas()
    })

    window.addEventListener('resize', resizeCanvas)
    return () => {
      window.removeEventListener('resize', resizeCanvas)
      padRef.current?.off()
    }
  }, [])

  function handleClear() {
    padRef.current?.clear()
    setIsEmpty(true)
  }

  function handleConfirm() {
    if (!padRef.current || padRef.current.isEmpty()) return
    onConfirm(padRef.current.toDataURL('image/png'))
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Capturar firma</h2>
          <p className="text-sm text-muted-foreground">{workerName} — firma con el lápiz digital en el área de abajo</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-2 hover:bg-muted/50 transition-colors"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 p-6 flex flex-col gap-3 min-h-0">
        <div className="flex-1 relative rounded-xl border-2 border-dashed border-border bg-white overflow-hidden">
          <canvas
            ref={canvasRef}
            // touch-none prevents the browser from scrolling while drawing
            className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
          />
          {isEmpty && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-300 pointer-events-none select-none">
              Firme aquí
            </p>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Use el lápiz digital o el dedo. La firma se incrustará en todos los espacios del documento.
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-6 py-4 shrink-0">
        <button
          onClick={handleClear}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Limpiar
        </button>
        <button
          onClick={handleConfirm}
          disabled={isEmpty}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Check className="h-4 w-4" />
          Confirmar firma
        </button>
      </div>
    </div>
  )
}
