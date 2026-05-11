import { getUserRole } from '@/app/(shared)/lib/auth'
import { createClient } from '@/lib/server'
import { getAllEmployees } from '@/app/(shared)/lib/db'
import EmployeesList from './EmployeesList'

export default async function EmployeesPage() {
  const supabase = await createClient()
  const [role, employees] = await Promise.all([
    getUserRole(),
    getAllEmployees(supabase),
  ])
  return <EmployeesList role={role} employees={employees} />
}
