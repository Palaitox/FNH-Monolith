import { notFound } from 'next/navigation'
import {
  getDriverById,
  getDriverComplianceAction,
  listDocumentRequirements,
} from '@/app/buses/actions/buses'
import { getUserRole } from '@/app/(shared)/lib/auth'
import DriverDetail from './DriverDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DriverDetailPage({ params }: Props) {
  const { id } = await params

  const [driver, compliance, requirements, role] = await Promise.all([
    getDriverById(id),
    getDriverComplianceAction(id),
    listDocumentRequirements('driver'),
    getUserRole(),
  ])

  if (!driver) notFound()

  return (
    <DriverDetail driver={driver} compliance={compliance} requirements={requirements} role={role} />
  )
}
