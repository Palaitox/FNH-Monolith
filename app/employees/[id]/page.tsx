import { getEmployeeById, getEmployeeContractsAction } from '@/app/employees/actions/employees'
import { getEmployeeLeavesAction } from '@/app/employees/actions/leaves'
import { getUserRole } from '@/app/(shared)/lib/auth'
import EmployeeDetail from './EmployeeDetail'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EmployeeDetailPage({ params }: Props) {
  const { id } = await params
  const [employee, contracts, leaves, role] = await Promise.all([
    getEmployeeById(id),
    getEmployeeContractsAction(id),
    getEmployeeLeavesAction(id),
    getUserRole(),
  ])

  if (!employee) notFound()

  return <EmployeeDetail employee={employee} contracts={contracts} leaves={leaves} role={role} />
}
