# Session Handoff — FNH Monolith

> Actualizar al cerrar cada bloque de trabajo. Máximo ~500 palabras. El historial detallado vive en `implementation_plan.md.md`.

---

## ¿En qué fase estamos?
**Phase 18 ✅ y deployada. Rama `improvements` activa con bug fix de firma worker (ND-65). Merge a `main` pendiente de deploy.**

Migraciones aplicadas en producción: 0001–0020.

---

## Estado real hoy (2026-05-29)

### Completado en esta sesión (rama `improvements`)
- ✅ Fix bug firma portal worker: error "An unexpected response was received from the server"
  al firmar — causa: PDF base64 superaba límite 1MB de Server Actions.
  Fix: `serverActions.bodySizeLimit: '10mb'` en `next.config.ts` — ND-65

### Completado en sesiones anteriores (rama `improvements`)
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
- ⏳ Probar portal `/worker` en producción con empleado real que tenga cuenta worker activa
- ⏳ Probar flujo Otro Sí Ampliación completo en producción
- ⏳ Probar login iPad Air (iOS 12) con fix transpilePackages — ND-60
- ⏳ Aplicar patrón ND-58 a `createDriverAction`

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

---

## ⚠️ Dato crítico de infraestructura

La app usa **`qolnrtoznrgiedyhffbn.supabase.co`**.  
El MCP de Supabase en sesión **apunta a `ukzccqogkbfdtymmgavj`** (proyecto diferente).  
Cualquier migración SQL debe correrse manualmente en el Dashboard del proyecto correcto (`qolnrtoznrgiedyhffbn`).

---

## Siguiente acción concreta

1. Probar portal `/worker` en producción con empleado real que tenga cuenta worker activa
2. Probar flujo Otro Sí Ampliación completo (crear → firmar trabajador → firmar rep.)
3. Probar login iPad Air (iOS 12) — ND-60
4. Aplicar patrón ND-58 a `createDriverAction`

---

## Errores recientes a evitar
- En producción Next.js sanitiza errores de Server Actions — usar `return { error }` no `throw` — ND-58
- `db/employees.ts` importa `DOCUMENT_SELECT` directo de `./contracts`, nunca via el index — ND-51
- Contratos subidos manualmente tienen `firma_trabajador = null` — es correcto, no un bug — ND-53
- No consultar el MCP de Supabase para verificar producción — apunta al proyecto equivocado
- Pasar `React.ReactElement` como prop dentro de `<Text>` en react-pdf descarta páginas silenciosamente
- iOS 12 no soporta `??` ni `?.` — siempre mantener `transpilePackages` en `next.config.ts` — ND-60
- Nueva sección sin guard worker en su layout → workers ganan acceso — ND-61
- `WorkerVerificationModal` con cliente Supabase normal → reemplaza sesión del coordinador — ND-62
- PDF base64 en Server Action supera 1MB por defecto → error opaco — mantener `bodySizeLimit: '10mb'` — ND-65
