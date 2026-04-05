import { getUserRole } from '@/app/(shared)/lib/auth'
import { redirect } from 'next/navigation'
import NewVerificationForm from './NewVerificationForm'

export default async function NewVerificationPage() {
  const role = await getUserRole()
  if (role === 'viewer') redirect('/buses/verification')
  return <NewVerificationForm />
}
