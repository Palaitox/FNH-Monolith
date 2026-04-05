import { notFound } from 'next/navigation'
import {
  getVehicleById,
  getVehicleComplianceAction,
  listDocumentRequirements,
} from '@/app/buses/actions/buses'
import { getUserRole } from '@/app/(shared)/lib/auth'
import VehicleDetail from './VehicleDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function VehicleDetailPage({ params }: Props) {
  const { id } = await params

  const [vehicle, compliance, requirements, role] = await Promise.all([
    getVehicleById(id),
    getVehicleComplianceAction(id),
    listDocumentRequirements('vehicle'),
    getUserRole(),
  ])

  if (!vehicle) notFound()

  return <VehicleDetail vehicle={vehicle} compliance={compliance} requirements={requirements} role={role} />
}
