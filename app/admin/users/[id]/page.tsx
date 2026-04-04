import { getUserAction } from '@/app/admin/actions/users'
import { getUserClaims } from '@/app/(shared)/lib/auth'
import UserDetail from './UserDetail'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params
  const [user, claims] = await Promise.all([
    getUserAction(id),
    getUserClaims(),
  ])

  if (!user) notFound()

  return <UserDetail user={user} currentUserId={claims?.sub ?? null} />
}
