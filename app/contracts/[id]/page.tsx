import { notFound } from 'next/navigation'
import { createClient } from '@/lib/server'
import { getDocument, getDocumentAuditLogs, getEmployee } from '@/app/(shared)/lib/db'
import { getUserRole } from '@/app/(shared)/lib/auth'
import { getInitialContractDates } from '@/app/contracts/actions/contracts'
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

  const [employee, initialContractDates] = await Promise.all([
    getEmployee(supabase, doc.contract_cases?.employee_id ?? ''),
    doc.document_type === 'OTRO_SI' && doc.case_id
      ? getInitialContractDates(doc.case_id)
      : Promise.resolve(null),
  ])

  return (
    <ContractDetail
      contract={doc}
      auditLogs={auditLogs}
      employee={employee}
      role={role}
      initialContractDates={initialContractDates}
    />
  )
}
