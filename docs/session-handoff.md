# Session Handoff — FNH Monolith

> Actualizar al cerrar cada bloque de trabajo. Máximo ~500 palabras. El historial detallado vive en `implementation_plan.md.md`.

---

## ¿En qué fase estamos?
**Phase 15 completada y mergeada a main. Phase 16 por definir.**

Phase 14 cerró con: carga de contratos históricos, módulo de contratos pulido, gap-fill de numeración.
Phase 15 añadió: campo `ciudad_cedula`, licencias de empleados (`employee_leaves`), override `en_licencia`, split de creación de contratos.

---

## Estado real hoy (2026-04-18)

### Completado en Phase 15
- ✅ Campo `ciudad_cedula` en empleados (migration 0015) — visible en formularios y en PDF ("expedida en …")
- ✅ Forma de pago actualizada: "MENSUAL ENTRE EL DÍA QUINCE (15) Y EL DÍA VEINTE (20) DE CADA MES"
- ✅ Split de creación de contratos: "Nuevo contrato inicial" (TC/MT/PS) vs "Agregar al expediente" (Otro Sí) — ND-48
- ✅ `+ Agregar` solo aparece en casos que ya tienen documento INICIAL — ND-48
- ✅ Grid de stats de empleados corregido: 5 columnas sin orphan card
- ✅ Tabla `employee_leaves` (migration 0016 aplicada en producción) + UI de gestión en `EmployeeDetail`
- ✅ Override `en_licencia` en `groupByCases()` y `getEmployeeContractStatusAction()` — ND-49
- ✅ Dashboard: 4ª card "En licencia" (violeta) + lista de empleados en licencia
- ✅ NDs 48 y 49 registradas
- ✅ `Schema.sql.md` actualizado con migraciones 0015–0016
- ✅ Mergeado a `main`, Vercel deploy exitoso

### Pendiente operativo (no code)
- ⏳ Registrar el contrato 2025 de **Laura Angélica Ramírez** (flujo de importar PDF firmado, fechas reales de 2025) y crear su licencia de maternidad en `/employees/[id]`

---

## ¿Qué no puedo romper?

| Invariante | Dónde está | ND |
|---|---|---|
| Override `en_licencia` en DOS lugares: `groupByCases()` + `getEmployeeContractStatusAction()` | `contracts/page.tsx` y `contracts/actions/contracts.ts` | ND-49 |
| `+ Agregar` solo si el caso tiene documento INICIAL | `ContractsList.tsx`: `group.docs.some(d => d.document_type === 'INICIAL')` | ND-48 |
| Tipos iniciales (TC/MT/PS) crean case nuevo; Otro Sí se adjunta al case existente | `NewContractForm.tsx`: `modoAdicional = !!preCaseId` | ND-48 |
| `claim_next_case_number()` escanea la tabla, no un contador persistente | `db.ts` → `supabase.rpc('claim_next_case_number')` | ND-46 |
| `deleteContractAction` borra el case si queda vacío de documentos | `contracts/actions/contracts.ts` | ND-46 |
| Vigencia usa `current_end_date ?? fecha_terminacion(INICIAL)` | `ContractsList.tsx` y `getEmployeeContractStatusAction` | ND-47 |
| `middleware.ts` usa `getClaims()`, no `getUser()` | `middleware.ts` | ND-13 |
| `contract-pdf.tsx` es BROWSER-ONLY — dynamic import only | `contracts/lib/contract-pdf.tsx` | ND-36 |
| Orden FK en deleteUserAction: `public.users` primero | `admin/actions/users.ts` | ND-42 |
| `pako` pinned a v1 en `package.json` overrides | `package.json` | ND-35 |

---

## ⚠️ Dato crítico de infraestructura

La app usa **`qolnrtoznrgiedyhffbn.supabase.co`**.
El MCP de Supabase en sesión **apunta a `ukzccqogkbfdtymmgavj`** (proyecto diferente).
Cualquier migración SQL debe correrse manualmente en el Dashboard del proyecto correcto (`qolnrtoznrgiedyhffbn`).

---

## Siguiente acción concreta

1. Registrar contrato 2025 de Laura Angélica Ramírez + crear su licencia de maternidad
2. Definir features de Phase 16 con el usuario
3. Desarrollar en rama `improvements` → commit → merge a `main`

---

## Errores recientes a evitar
- `let { a, b } = fn()` donde `b` nunca se reasigna → ESLint `prefer-const` lo convierte en error de build; usar `const result = fn(); let a = result.a; const b = result.b`
- No consultar el MCP de Supabase para verificar estado de producción — apunta al proyecto equivocado
- Pasar `React.ReactElement` como prop dentro de `<Text>` en react-pdf descarta páginas silenciosamente
