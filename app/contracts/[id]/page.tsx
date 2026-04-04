import { notFound } from 'next/navigation'
import { createClient } from '@/lib/server'
import { getContract, getContractAuditLogs, getEmployee } from '@/app/(shared)/lib/db'
import ContractDetail from './ContractDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ContractDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [contract, auditLogs] = await Promise.all([
    getContract(supabase, id),
    getContractAuditLogs(supabase, id),
  ])

  if (!contract) notFound()

  const employee = await getEmployee(supabase, contract.employee_id)

  return <ContractDetail contract={contract} auditLogs={auditLogs} employee={employee} />
}
