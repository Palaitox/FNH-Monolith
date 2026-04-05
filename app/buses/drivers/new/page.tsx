import { getUserRole } from '@/app/(shared)/lib/auth'
import { redirect } from 'next/navigation'
import NewDriverForm from './NewDriverForm'

export default async function NewDriverPage() {
  const role = await getUserRole()
  if (role === 'viewer') redirect('/buses/drivers')
  return <NewDriverForm />
}
