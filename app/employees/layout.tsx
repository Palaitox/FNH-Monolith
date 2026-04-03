import { getUserRole } from '@/app/(shared)/lib/auth'
import AppNav from '@/app/(app)/AppNav'

export default async function EmployeesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const role = await getUserRole()
  return (
    <>
      <AppNav role={role} />
      {children}
    </>
  )
}
