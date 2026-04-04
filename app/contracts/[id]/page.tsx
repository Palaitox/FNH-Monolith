import { notFound } from 'next/navigation'
import { createClient } from '@/lib/server'
import { getContract, getContractAuditLogs, getEmployee } from '@/app/(shared)/lib/db'
import { getUserRole } from '@/app/(shared)/lib/auth'
import ContractDetail from './ContractDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ContractDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [contract, auditLogs, role] = await Promise.all([
    getContract(supabase, id),
    getContractAuditLogs(supabase, id),
    getUserRole(),
  ])

  if (!contract) notFound()

  const employee = await getEmployee(supabase, contract.employee_id)

  return <ContractDetail contract={contract} auditLogs={auditLogs} employee={employee} role={role} />
}
