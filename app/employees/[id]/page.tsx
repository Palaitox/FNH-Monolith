import { getEmployeeById, getEmployeeContractsAction } from '@/app/employees/actions/employees'
import { getUserRole } from '@/app/(shared)/lib/auth'
import EmployeeDetail from './EmployeeDetail'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EmployeeDetailPage({ params }: Props) {
  const { id } = await params
  const [employee, contracts, role] = await Promise.all([
    getEmployeeById(id),
    getEmployeeContractsAction(id),
    getUserRole(),
  ])

  if (!employee) notFound()

  return <EmployeeDetail employee={employee} contracts={contracts} role={role} />
}
