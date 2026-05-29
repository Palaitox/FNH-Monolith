import { redirect } from 'next/navigation'
import { getUserRole } from '@/app/(shared)/lib/auth'
import AppNav from './AppNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = await getUserRole()

  // Workers don't use the main app — send them to their personal signing portal
  if (role === 'worker') redirect('/worker')

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav role={role} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
