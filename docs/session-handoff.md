# Session Handoff — FNH Monolith

> Actualizar al cerrar cada bloque de trabajo. Máximo ~500 palabras. El historial detallado vive en `implementation_plan.md.md`.

---

## ¿En qué fase estamos?
**Phase 18 ✅ completa y estable. Todos los pendientes operativos resueltos. Sin deuda técnica abierta.**

Migraciones aplicadas en producción: 0001–0021 (0021 aplicada manualmente).

---

## Estado real hoy (2026-06-10)

### Completado en esta sesión (rama `improvements`)
- ✅ Storage RLS fix: políticas `contracts_storage_insert/update_coord_admin` ahora incluyen `supervisor`
  (migration 0021, aplicada manualmente en `qolnrtoznrgiedyhffbn`) — ND-67
- ✅ Invite flow: `/auth/invite` maneja formato actual de Supabase (`?token_hash=...&type=...` via `verifyOtp`)
  además de hash implícito y PKCE — ND-68
- ✅ Admin: sección "Workers" separada y colapsable, card "Workers activos", chip estado invitación — ND-66
- ✅ `contract-pdf.tsx` — `OtroSiAmpliacion`: `break` en cláusula SEGUNDA evita firmas huérfanas — ND-59

### Completado en sesiones anteriores (rama `improvements`)
- ✅ Fix bug firma worker coordinador: `WorkerVerificationModal` usaba `createBrowserClient` de `@supabase/ssr`
  (sobreescribe cookies, singleton) → reemplazado por `createClient` de `@supabase/supabase-js` — ND-62
- ✅ Fix bug firma portal worker: storage RLS violation → service client puro sin overlay de cookies — ND-63
- ✅ `serverActions.bodySizeLimit: '10mb'` en `next.config.ts` — ND-65
- ✅ `createDriverAction` aplica patrón ND-58: retorna `{ driver } | { error }`, 23505 → mensaje legible
- ✅ Portal `/worker` probado en producción con empleado real ✓
- ✅ Flujo Otro Sí Ampliación probado en producción ✓ (contenido pendiente aprobación coordinadora)
- ✅ iPad Air reemplazado por tablet nuevo con magic pen — funciona correctamente
- ✅ IP + User-Agent en `system_logs` al firmar (trabajador y representante) — Gaps 1–2 Phase 18
- ✅ `system_logs` forense para firma del representante (antes solo en `contract_audit_logs`)
- ✅ Texto de consentimiento legal en `SignatureModal` antes del canvas — Decreto 2364/2012
- ✅ Botón "Enviar copia al empleado" + `sendContractCopyAction` via Resend
- ✅ Rol `worker` (migration 0020): `ROLE_HIERARCHY = -1`, guards en 5 layouts — ND-61
- ✅ `inviteWorkerAction` / `revokeWorkerAccountAction` desde detalle del empleado
- ✅ `WorkerVerificationModal` — credenciales en memoria, sesión coordinador intacta — ND-62
- ✅ Portal `/worker` con contratos propios + firma desde portal — ND-63
- ✅ `workerSignContractAction` — service client + autorización por `case_id → employee_id` — ND-63
- ✅ Route guards en `contracts/`, `dashboard/`, `employees/`, `buses/`, `admin/` layouts
- ✅ `OTRO_SI_AMPLIACION` como document_type separado (migration 0019) — ND-64
- ✅ `affects_term = true` solo para `OTRO_SI_AMPLIACION`, no para `OTRO_SI`
- ✅ `+ Agregar` habilitado para contratos vencidos (quitado guard `!isExpired`)
- ✅ `OtroSiPago` restaurado con fecha hardcodeada `2026-05-16`
- ✅ `OtroSiAmpliacion` ajustado a plantilla real (ciudad uppercase en tabla, Para Constancia sin bold)
- ✅ NDs 61–65 documentadas; ND-59 actualizada

### Pendiente operativo
- ⏳ Aprobación de contenido del Otro Sí Ampliación por la coordinadora
- ⏳ Phase 19 — features por definir

---

## ¿Qué no puedo romper?

| Invariante | Dónde está | ND |
|---|---|---|
| `PGRST116` → `return null`; otros errores → `throw` | `db/employees.ts`, `db/contracts.ts`, `buses/actions/buses.ts` | ND-50 |
| `db/employees.ts` importa `DOCUMENT_SELECT` directo de `./contracts`, nunca via index | `db/employees.ts:8` | ND-51 |
| `page.tsx` fetches server-side → props a Client Components; nunca `useEffect` para carga inicial | `employees/page.tsx`, `contracts/page.tsx`, `dashboard/page.tsx` | ND-52 |
| Override `en_licencia` en DOS lugares: `groupByCases()` + `getEmployeeContractStatusAction()` | `contracts/page.tsx` y `contracts/actions/contracts.ts` | ND-49 |
| `+ Agregar` solo si el caso tiene documento INICIAL (vencidos sí pueden tener Otro Sí) | `ContractsList.tsx` | ND-48 |
| `claim_next_case_number()` escanea la tabla, no contador persistente | `db/contracts.ts` → `supabase.rpc('claim_next_case_number')` | ND-46 |
| `deleteContractAction` borra el case si queda vacío de documentos | `contracts/actions/contracts.ts` | ND-46 |
| Vigencia: `current_end_date ?? fecha_terminacion(INICIAL)` | `ContractsList.tsx` y `getEmployeeContractStatusAction` | ND-47 |
| `middleware.ts` usa `getClaims()`, no `getUser()` | `lib/middleware.ts` | ND-13 |
| `contract-pdf.tsx` BROWSER-ONLY — dynamic import only | `contracts/lib/contract-pdf.tsx` | ND-36 |
| Orden FK en deleteUserAction: `public.users` primero | `admin/actions/users.ts` | ND-42 |
| `pako` pinned a v1 en `package.json` overrides | `package.json` | ND-35 |
| `firma_trabajador` siempre se pasa a `attachSignedPdfAction` al firmar via pad | `ContractDetail.tsx:handleSignatureConfirmed` (5° arg) | ND-53 |
| Sección firma rep. solo visible cuando `!!contract.firma_trabajador` | `ContractDetail.tsx` condición del bloque rep. | ND-54 |
| `attachRepresentativeSignatureAction` usa `requireRole('supervisor')`, no `coordinator` | `contracts/actions/contracts.ts` | ND-55 |
| SigSpace empleador = `v.firma_representante`; trabajador = `v.firma` | `contract-pdf.tsx` (columna izq.) | ND-56 |
| `sinExpediente` = `docs.length === 0`; `sinContrato` = tuvo docs pero ninguno vigente | `contracts/actions/contracts.ts:getEmployeeContractStatusAction` | ND-57 |
| Server Actions con errores visibles al usuario deben RETORNAR `{ error }`, no lanzar | `buses/actions/buses.ts:createVehicleAction` (patrón) | ND-58 |
| `OTRO_SI_AMPLIACION` requiere `otroSiData` en `buildContractVars`; sin él fechas vacías | `pdf-vars.ts`, `contract-pdf.tsx` | ND-59 |
| `transpilePackages: ['@supabase/ssr', '@supabase/supabase-js']` en `next.config.ts` — no eliminar | `next.config.ts` | ND-60 |
| Rol `worker` tiene `ROLE_HIERARCHY = -1`; nueva sección DEBE tener guard en su `layout.tsx` | `auth.ts`, 5 layouts de sección | ND-61 |
| `WorkerVerificationModal` usa `persistSession: false + memoryStorage` — nunca cliente normal | `app/contracts/[id]/WorkerVerificationModal.tsx` | ND-62 |
| `workerSignContractAction` verifica `case_id → employee_id = worker's employee_id` antes de firmar | `app/worker/actions.ts` | ND-63 |
| `serverActions.bodySizeLimit: '10mb'` en `next.config.ts` — no reducir ni eliminar | `next.config.ts` | ND-65 |
| Selectores de rol en admin SOLO iteran `MANAGEMENT_ROLES`; workers se invitan vía `inviteWorkerAction`, nunca desde `/admin/users/new` | `admin/types.ts`, `admin/users/new/page.tsx`, `admin/users/[id]/UserDetail.tsx` | ND-66 |
| `OtroSiAmpliacion`: `break` en cláusula SEGUNDA mantiene firmas junto a esa cláusula (pág. 2 de 3) | `contract-pdf.tsx` | ND-59 |
| Al agregar un nuevo rol: actualizar CHECK constraint en `public.users` Y las políticas `contracts_storage_insert/update_coord_admin` en `storage.objects` | `supabase/migrations/0021_...sql` | ND-67 |
| `/auth/invite` maneja 3 formatos de token en orden fijo: `token_hash` → hash implícito → `code` | `app/auth/invite/page.tsx` | ND-68 |

---

## ⚠️ Dato crítico de infraestructura

La app usa **`qolnrtoznrgiedyhffbn.supabase.co`**.  
El MCP de Supabase en sesión **apunta a `ukzccqogkbfdtymmgavj`** (proyecto diferente).  
Cualquier migración SQL debe correrse manualmente en el Dashboard del proyecto correcto (`qolnrtoznrgiedyhffbn`).

---

## Siguiente acción concreta

1. Crear cuenta de supervisor alternativa para testing (vía Dashboard de Supabase o invite desde `/admin`)
2. Definir features para Phase 19 con el usuario
3. Esperar aprobación de contenido del Otro Sí Ampliación por la coordinadora

---

## Errores recientes a evitar
- En producción Next.js sanitiza errores de Server Actions — usar `return { error }` no `throw` — ND-58
- `db/employees.ts` importa `DOCUMENT_SELECT` directo de `./contracts`, nunca via el index — ND-51
- Contratos subidos manualmente tienen `firma_trabajador = null` — es correcto, no un bug — ND-53
- No consultar el MCP de Supabase para verificar producción — apunta al proyecto equivocado
- Pasar `React.ReactElement` como prop dentro de `<Text>` en react-pdf descarta páginas silenciosamente
- iOS 12 no soporta `??` ni `?.` — siempre mantener `transpilePackages` en `next.config.ts` — ND-60
- Nueva sección sin guard worker en su layout → workers ganan acceso — ND-61
- `WorkerVerificationModal` con `createBrowserClient` de `@supabase/ssr` → sobreescribe cookies del coordinador (ignora `auth.storage` + singleton) — usar `createClient` de `@supabase/supabase-js` — ND-62
- PDF base64 en Server Action supera 1MB por defecto → error opaco — mantener `bodySizeLimit: '10mb'` — ND-65
- No agregar `'worker'` a `MANAGEMENT_ROLES`/selectores de admin — los workers se vinculan a `employees.user_id` solo vía `inviteWorkerAction` — ND-66
- En PDFs react-pdf, `break` en un `<Text>`/`<View>` fuerza salto de página antes de ese elemento — útil para evitar firmas huérfanas, pero no balancea el contenido previo — ND-59
- Al agregar un rol nuevo al sistema, las políticas de Storage no se actualizan solas — hay que DROP + CREATE `contracts_storage_insert/update_coord_admin` con el nuevo rol — ND-67
- El link de invitación de Supabase usa `?token_hash=...&type=...` (no hash implícito) — si se simplifica `/auth/invite` a un solo handler, los invitados no pueden crear contraseña — ND-68
