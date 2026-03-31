import { notFound } from 'next/navigation'
import {
  getVehicleById,
  getVehicleComplianceAction,
  listDocumentRequirements,
} from '@/app/buses/actions/buses'
import VehicleDetail from './VehicleDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function VehicleDetailPage({ params }: Props) {
  const { id } = await params

  const [vehicle, compliance, requirements] = await Promise.all([
    getVehicleById(id),
    getVehicleComplianceAction(id),
    listDocumentRequirements('vehicle'),
  ])

  if (!vehicle) notFound()

  return <VehicleDetail vehicle={vehicle} compliance={compliance} requirements={requirements} />
}
