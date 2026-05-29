import { redirect } from 'next/navigation'
import { getUserRole } from '@/app/(shared)/lib/auth'
import { getWorkerContractsAction } from './actions'
import { getAppSettings } from '@/app/contracts/actions/contracts'
import WorkerSigningPanel from './WorkerSigningPanel'

export default async function WorkerPage() {
  const role = await getUserRole()
  if (role !== 'worker') redirect('/')

  const [contractsResult, settings] = await Promise.all([
    getWorkerContractsAction(),
    getAppSettings(),
  ])

  if ('error' in contractsResult) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-destructive">{contractsResult.error}</p>
      </div>
    )
  }

  if (!contractsResult.employee) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-2">
          <p className="text-base font-semibold">Cuenta no vinculada</p>
          <p className="text-sm text-muted-foreground">
            Tu cuenta de usuario no está vinculada a ningún empleado. Comunícate con el área
            de recursos humanos para que activen tu acceso de firma.
          </p>
        </div>
      </div>
    )
  }

  return (
    <WorkerSigningPanel
      employee={contractsResult.employee as Parameters<typeof WorkerSigningPanel>[0]['employee']}
      documents={contractsResult.documents}
      settings={settings}
    />
  )
}
