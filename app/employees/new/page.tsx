import { getUserRole } from '@/app/(shared)/lib/auth'
import { redirect } from 'next/navigation'
import NewEmployeeForm from './NewEmployeeForm'

export default async function NewEmployeePage() {
  const role = await getUserRole()
  if (role === 'viewer') redirect('/employees')
  return <NewEmployeeForm />
}
