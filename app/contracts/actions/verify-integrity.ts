'use server'

/**
 * verify-integrity.ts
 *
 * Server Action: downloads a contract PDF from Supabase Storage and
 * recomputes its SHA-256, then compares to the hash stored in the DB.
 *
 * Uses Node's crypto module — NOT security.js (which is browser-only).
 */

import crypto from 'node:crypto'
import { createClient } from '@/lib/server'
import { getContract } from '@/app/(shared)/lib/db'
import type { IntegrityResult } from '@/app/contracts/types'

const STORAGE_BUCKET = 'contracts'

export async function verifyContractIntegrity(contractId: string): Promise<IntegrityResult> {
  const supabase = await createClient()

  const contract = await getContract(supabase, contractId)
  if (!contract) {
    return { match: false, storedHash: null, computedHash: null, reason: 'Contrato no encontrado.' }
  }

  if (!contract.pdf_path) {
    return { match: false, storedHash: null, computedHash: null, reason: 'No hay PDF registrado para este contrato.' }
  }

  if (!contract.pdf_hash) {
    return { match: false, storedHash: null, computedHash: null, reason: 'No hay hash registrado para verificar.' }
  }

  // Download PDF from Supabase Storage
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(contract.pdf_path)

  if (error || !data) {
    return {
      match: false,
      storedHash: contract.pdf_hash,
      computedHash: null,
      reason: `No se pudo descargar el PDF: ${error?.message ?? 'error desconocido'}`,
    }
  }

  const buffer = Buffer.from(await data.arrayBuffer())
  const computedHash = crypto.createHash('sha256').update(buffer).digest('hex')

  return {
    match: computedHash === contract.pdf_hash,
    storedHash: contract.pdf_hash,
    computedHash,
  }
}
