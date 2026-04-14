import { notFound } from 'next/navigation'
import { createClient } from '@/lib/server'
import { getDocument, getDocumentAuditLogs, getEmployee } from '@/app/(shared)/lib/db'
import { getUserRole } from '@/app/(shared)/lib/auth'
import ContractDetail from './ContractDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ContractDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [doc, auditLogs, role] = await Promise.all([
    getDocument(supabase, id),
    getDocumentAuditLogs(supabase, id),
    getUserRole(),
  ])

  if (!doc) notFound()

  const employee = await getEmployee(supabase, doc.contract_cases?.employee_id ?? '')

  return <ContractDetail contract={doc} auditLogs={auditLogs} employee={employee} role={role} />
}
