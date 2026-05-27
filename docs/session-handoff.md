# Session Handoff — FNH Monolith

> Actualizar al cerrar cada bloque de trabajo. Máximo ~500 palabras. El historial detallado vive en `implementation_plan.md.md`.

---

## ¿En qué fase estamos?
**Phase 17 ✅. Plantilla "Otro Sí de Ampliación" completa + fix iOS 12. Rama `improvements` — pendiente deploy.**

Migraciones aplicadas en producción: 0001–0018. Sin migraciones nuevas en esta sesión.

---

## Estado real hoy (2026-05-26)

### Completado en esta sesión (rama `improvements`)
- ✅ `contract-pdf.tsx:OtroSi` reconstruido — 3 páginas: acuerdo ampliación (págs. 1–2) + preaviso vencimiento (pág. 3)
- ✅ `pdf-vars.ts`: `OtroSiAmpliacionVars`, utilidades de fecha en español, `buildOtroSiAmpliacion()`
- ✅ `NewContractForm.tsx`: campos fecha inicio/fin extensión + fetch automático fechas originales del INICIAL
- ✅ `page.tsx` + `ContractDetail.tsx`: `otroSiData` disponible al firmar desde el detalle del documento
- ✅ `affects_term = true` para OTRO_SI en `createContractAction` — ND-59
- ✅ Fix iOS 12 / Safari 12: `transpilePackages` en `next.config.ts` — ND-60
- ✅ NDs 59–60 documentadas

### Pendiente operativo
- ⏳ Probar flujo OTRO_SI completo en producción (crear → firmar trabajador → firmar rep.)
- ⏳ Probar login en iPad Air (iOS 12) con el fix transpilePackages
- ⏳ Aplicar patrón ND-58 a `createDriverAction`

---

## ¿Qué no puedo romper?

| Invariante | Dónde está | ND |
|---|---|---|
| `PGRST116` → `return null`; otros errores → `throw` | `db/employees.ts`, `db/contracts.ts`, `buses/actions/buses.ts` | ND-50 |
| `db/employees.ts` importa `DOCUMENT_SELECT` directo de `./contracts`, nunca via index | `db/employees.ts:8` | ND-51 |
| `page.tsx` fetches server-side → props a Client Components; nunca `useEffect` para carga inicial | `employees/page.tsx`, `contracts/page.tsx`, `dashboard/page.tsx` | ND-52 |
| Override `en_licencia` en DOS lugares: `groupByCases()` + `getEmployeeContractStatusAction()` | `contracts/page.tsx` y `contracts/actions/contracts.ts` | ND-49 |
| `+ Agregar` solo si el caso tiene documento INICIAL | `ContractsList.tsx`: `group.docs.some(d => d.document_type === 'INICIAL')` | ND-48 |
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
| OTRO_SI requiere `otroSiData` en `buildContractVars`; sin él las fechas quedan vacías | `pdf-vars.ts`, `contract-pdf.tsx` | ND-59 |
| `affects_term = true` para PRORROGA **y** OTRO_SI — sin esto la vigencia no se actualiza | `contracts/actions/contracts.ts:createContractAction` | ND-59 |
| `transpilePackages: ['@supabase/ssr', '@supabase/supabase-js']` en `next.config.ts` — no eliminar | `next.config.ts` | ND-60 |

---

## ⚠️ Dato crítico de infraestructura

La app usa **`qolnrtoznrgiedyhffbn.supabase.co`**.  
El MCP de Supabase en sesión **apunta a `ukzccqogkbfdtymmgavj`** (proyecto diferente).  
Cualquier migración SQL debe correrse manualmente en el Dashboard del proyecto correcto (`qolnrtoznrgiedyhffbn`).

---

## Siguiente acción concreta

1. Probar flujo OTRO_SI completo en producción
2. Probar login iPad Air (iOS 12)
3. Aplicar patrón ND-58 a `createDriverAction`

---

## Errores recientes a evitar
- En producción Next.js sanitiza errores de Server Actions — usar `return { error }` no `throw` — ND-58
- `db/employees.ts` importa `DOCUMENT_SELECT` directo de `./contracts`, nunca via el index — ND-51
- Contratos subidos manualmente tienen `firma_trabajador = null` — es correcto, no un bug — ND-53
- No consultar el MCP de Supabase para verificar producción — apunta al proyecto equivocado
- Pasar `React.ReactElement` como prop dentro de `<Text>` en react-pdf descarta páginas silenciosamente
- iOS 12 no soporta `??` ni `?.` — siempre mantener `transpilePackages` en `next.config.ts` — ND-60
