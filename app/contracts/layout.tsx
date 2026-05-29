import { redirect } from 'next/navigation'
import { getUserRole } from '@/app/(shared)/lib/auth'
import AppNav from '@/app/(app)/AppNav'

export default async function ContractsLayout({ children }: { children: React.ReactNode }) {
  const role = await getUserRole()
  if (role === 'worker') redirect('/worker')
  return (
    <div className="min-h-screen flex flex-col">
      <AppNav role={role} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
