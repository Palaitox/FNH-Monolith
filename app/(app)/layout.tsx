import { getUserRole } from '@/app/(shared)/lib/auth'
import AppNav from './AppNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = await getUserRole()

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav role={role} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
