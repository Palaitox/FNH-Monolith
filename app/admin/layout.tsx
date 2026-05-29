import { getUserRole } from '@/app/(shared)/lib/auth'
import AppNav from '@/app/(app)/AppNav'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = await getUserRole()

  // Workers go to their portal; other non-admins go to dashboard
  if (role === 'worker') redirect('/worker')
  if (role !== 'admin') redirect('/dashboard')

  return (
    <>
      <AppNav role={role} />
      {children}
    </>
  )
}
