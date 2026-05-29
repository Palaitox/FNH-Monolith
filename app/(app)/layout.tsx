import { getUserRole } from '@/app/(shared)/lib/auth'
import AppNav from './AppNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = await getUserRole()

  if (role === 'worker') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-3">
          <p className="text-lg font-semibold tracking-tight">Acceso restringido</p>
          <p className="text-sm text-muted-foreground">
            Esta cuenta solo está habilitada para verificar tu identidad al momento de firmar
            contratos. Para firmar un documento, solicítale a la coordinadora que abra el
            contrato en el dispositivo.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav role={role} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
