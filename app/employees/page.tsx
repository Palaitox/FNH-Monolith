import { getUserRole } from '@/app/(shared)/lib/auth'
import EmployeesList from './EmployeesList'

export default async function EmployeesPage() {
  const role = await getUserRole()
  return <EmployeesList role={role} />
}
