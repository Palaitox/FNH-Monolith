import { getUserRole } from '@/app/(shared)/lib/auth'
import { redirect } from 'next/navigation'
import NewVehicleForm from './NewVehicleForm'

export default async function NewVehiclePage() {
  const role = await getUserRole()
  if (role === 'viewer') redirect('/buses/vehicles')
  return <NewVehicleForm />
}
