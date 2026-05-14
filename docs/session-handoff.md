# Session Handoff — FNH Monolith

> Actualizar al cerrar cada bloque de trabajo. Máximo ~500 palabras. El historial detallado vive en `implementation_plan.md.md`.

---

## ¿En qué fase estamos?
**Phase 16 ✅. Rama `improvements` con mejoras UI/UX — pendiente merge a main.**

Migraciones aplicadas en producción: 0001–0018. Sin migraciones nuevas en esta sesión.

---

## Estado real hoy (2026-05-14)

### Completado en esta sesión (rama `improvements`)
- ✅ Dora Patricia invitada con rol `supervisor` desde `/admin`
- ✅ Expediente 2025-07 de Laura Angélica Ramírez registrado via SQL + PDF subido + licencia de maternidad registrada
- ✅ Dashboard: eliminada sección "CONTRATOS" (4 cards redundantes); collapsibles para todos los grupos de estado contractual — ND-57
- ✅ Dashboard: nueva categoría "Sin expediente" (empleados sin ningún documento en sistema) separada de "Sin contrato vigente" — ND-57
- ✅ Dashboard: collapsible "Con contrato vigente" muestra lista de empleados y número de expediente activo
- ✅ Lista de contratos: agrupación por año (colapsada por defecto), orden por urgencia dentro de cada año (vencido → por_vencer → vigente → en_licencia → indefinido)
- ✅ Lista de contratos: vencidos con borde rose visible (antes era gris), filtros "Vencidos" y "Falta firma rep."
- ✅ `createVehicleAction` devuelve `{ error }` en vez de lanzar — fix bug en producción — ND-58
- ✅ Vehículos desactivados: visibles en lista (sección colapsada "Desactivados"), botón "Reactivar" en detalle del vehículo
- ✅ `deleteVehicleAction` (admin-only) con doble confirmación
- ✅ NDs 57–58 documentadas

### Pendiente operativo
- ⏳ Probar flujo dual-firma en producción (Dora Patricia debe aceptar la invitación primero)
- ⏳ Aplicar patrón ND-58 a `createDriverAction` (mismo riesgo de constraint unique en cédula)

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
| `sinExpediente` = `docs.length === 0`; `sinContrato` = tuvo docs pero ninguno vigente. No mezclar | `contracts/actions/contracts.ts:getEmployeeContractStatusAction` | ND-57 |
| Server Actions con errores visibles al usuario deben RETORNAR `{ error }`, no lanzar | `buses/actions/buses.ts:createVehicleAction` (patrón) | ND-58 |

---

## ⚠️ Dato crítico de infraestructura

La app usa **`qolnrtoznrgiedyhffbn.supabase.co`**.  
El MCP de Supabase en sesión **apunta a `ukzccqogkbfdtymmgavj`** (proyecto diferente).  
Cualquier migración SQL debe correrse manualmente en el Dashboard del proyecto correcto (`qolnrtoznrgiedyhffbn`).

---

## Siguiente acción concreta

1. Probar flujo dual-firma cuando Dora Patricia acepte la invitación
2. Aplicar patrón ND-58 a `createDriverAction`
3. Definir features de Phase 17 con el usuario

---

## Errores recientes a evitar
- En producción Next.js sanitiza errores de Server Actions — usar `return { error }` no `throw` — ND-58
- `db/employees.ts` importa `DOCUMENT_SELECT` directo de `./contracts`, nunca via el index — ND-51
- Contratos subidos manualmente tienen `firma_trabajador = null` — es correcto, no un bug — ND-53
- No consultar el MCP de Supabase para verificar producción — apunta al proyecto equivocado
- Pasar `React.ReactElement` como prop dentro de `<Text>` en react-pdf descarta páginas silenciosamente
