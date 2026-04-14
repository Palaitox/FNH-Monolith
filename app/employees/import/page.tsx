import { getUserRole } from '@/app/(shared)/lib/auth'
import { redirect } from 'next/navigation'
import ImportForm from './ImportForm'

export default async function ImportPage() {
  const role = await getUserRole()
  if (role === 'viewer') redirect('/employees')
  return <ImportForm />
}
