import { getUserRole } from '@/app/(shared)/lib/auth'
import { redirect } from 'next/navigation'
import NewContractForm from './NewContractForm'

export default async function NewContractPage() {
  const role = await getUserRole()
  if (role === 'viewer') redirect('/contracts')
  return <NewContractForm />
}
