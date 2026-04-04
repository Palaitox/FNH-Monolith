import { getUserRole } from '@/app/(shared)/lib/auth'
import AppNav from '@/app/(app)/AppNav'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = await getUserRole()

  // Hard redirect — non-admins cannot access any route under /admin
  if (role !== 'admin') redirect('/dashboard')

  return (
    <>
      <AppNav role={role} />
      {children}
    </>
  )
}
