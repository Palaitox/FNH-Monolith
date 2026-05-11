/**
 * db/index.ts — re-exports the entire query layer from domain-scoped modules.
 *
 * All code outside this directory imports from '@/app/(shared)/lib/db'.
 * Domain modules:
 *   employees.ts — employee read/write, bulk import
 *   contracts.ts — cases, documents, audit log, stats
 *   settings.ts  — app config row
 *   leaves.ts    — employee leave records
 */

export * from './employees'
export * from './contracts'
export * from './settings'
export * from './leaves'
