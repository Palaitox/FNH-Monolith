# Session Handoff — FNH Monolith

> Actualizar al cerrar cada bloque de trabajo. Máximo ~500 palabras. El historial detallado vive en `implementation_plan.md.md`.

---

## ¿En qué fase estamos?
**Phase 15.x ✅. Phase 16 en progreso — firma digital del representante legal.**

Migraciones aplicadas en producción: 0001–0018.
- 0017: rol `supervisor` en `users.role` CHECK constraint
- 0018: `firma_trabajador` + `firma_representante` en `contract_documents`

---

## Estado real hoy (2026-05-11)

### Completado en Phase 16 (sesión 2026-05-11)
- ✅ Rol `supervisor` en DB + jerarquía `viewer(0) < coordinator(1) < supervisor(2) < admin(3)` en `auth.ts` + colores violeta en `admin/types.ts` — ND-55
- ✅ `firma_trabajador` + `firma_representante` en `contract_documents` (migration 0018) — ND-53
- ✅ PDF: 5 slots del empleador/representante usan `v.firma_representante`; worker usa `v.firma` — ND-56
- ✅ `attachSignedPdfAction` persiste `firma_trabajador` al firmar via pad — ND-53
- ✅ `attachRepresentativeSignatureAction` (supervisor+) — genera PDF con ambas firmas — ND-55
- ✅ Sección firma rep. en `ContractDetail` gateada por `!!contract.firma_trabajador` — ND-54
- ✅ Dashboard: card "pendientes de firma del representante" visible a todos los roles
- ✅ Lista de contratos: badge "Falta firma rep." para supervisor/admin
- ✅ PDF: Helvetica 11pt en todo el cuerpo del contrato (corrección de Monica Durán)
- ✅ `forma_pago` actualizado a "MENSUAL ENTRE EL DÍA QUINCE (15) Y EL DÍA VEINTE (20)"
- ✅ `ciudad_cedula` en formulario de empleado, payload de upsert y PDF ("expedida en [city]")
- ✅ NDs 53, 54, 55, 56 registradas; ND-37 marcada como parcialmente supersedida

### Pendiente operativo (no code)
- ⏳ Invitar a Dora Patricia con rol `supervisor` desde `/admin`
- ⏳ Probar flujo completo dual-firma en producción (trabajador firma → `firma_trabajador` guardado → Dora Patricia firma → PDF con ambas firmas)
- ⏳ Registrar contrato 2025 de **Laura Angélica Ramírez** + crear su licencia de maternidad en `/employees/[id]`

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
| SigSpace empleador/representante = `v.firma_representante`; worker = `v.firma` | `contract-pdf.tsx` (5 slots columna izq.) | ND-56 |

---

## ⚠️ Dato crítico de infraestructura

La app usa **`qolnrtoznrgiedyhffbn.supabase.co`**.  
El MCP de Supabase en sesión **apunta a `ukzccqogkbfdtymmgavj`** (proyecto diferente).  
Cualquier migración SQL debe correrse manualmente en el Dashboard del proyecto correcto (`qolnrtoznrgiedyhffbn`).

---

## Siguiente acción concreta

1. Invitar a Dora Patricia con rol `supervisor` desde `/admin`
2. Probar flujo dual-firma en producción
3. Registrar contrato 2025 de Laura Angélica Ramírez + licencia de maternidad
4. Definir features de Phase 16 restantes con el usuario

---

## Errores recientes a evitar
- `let { a, b } = fn()` donde `b` nunca se reasigna → ESLint `prefer-const` falla en build
- No consultar el MCP de Supabase para verificar producción — apunta al proyecto equivocado
- Pasar `React.ReactElement` como prop dentro de `<Text>` en react-pdf descarta páginas silenciosamente
- `db/employees.ts` importa `DOCUMENT_SELECT` directo de `./contracts`, nunca via el index — ver ND-51
- Migration 0018 = `firma_representante` (NO `cargo_contract_texts` — ese feature fue revertido antes del commit)
- Contratos subidos manualmente tienen `firma_trabajador = null` — es correcto, no un bug
