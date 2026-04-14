# Session Handoff — FNH Monolith

> Actualizar al cerrar cada bloque de trabajo. Máximo ~500 palabras. El historial detallado vive en `implementation_plan.md.md`.

---

## ¿En qué fase estamos?
**Phase 13 completada. Phase 14 en curso** (carga de contratos históricos + módulo de contratos pulido).

Phase 13 cerró con: viewer role, UX improvements, Otro Sí, arquitectura de sesión.
Phase 14 abrió esta sesión con la carga de los 32 contratos históricos físicamente firmados.

---

## Estado real hoy (2026-04-14)

### Completado esta sesión
- ✅ `termino_indefinido` como 4° valor de `JornadaLaboral` (tipo + DB constraint + UI en 4 lugares)
- ✅ Importación de PDF firmado en el flujo de nuevo contrato (modo import vs. modo generate)
- ✅ Modelo de numeración de expedientes reescrito: gap-fill + auto-delete de casos huérfanos (ND-46)
- ✅ Migraciones 0012–0014 aplicadas en producción (`qolnrtoznrgiedyhffbn`)
- ✅ Vista de contratos rediseñada: árbol de expedientes con ramas, vigencia visual (ND-47)
- ✅ Búsqueda y filtros en el módulo de contratos (Client Component `ContractsList.tsx`)
- ✅ Sección "Estado contractual de empleados" en el dashboard (sin contrato / pendiente firma / vigente)
- ✅ NDs 46 y 47 registradas

### Pendiente
- ⏳ Terminar de subir los ~32 contratos físicos restantes (el usuario está en proceso)
- ⏳ Contrato de **Laura Ángela Ramírez Parra** (expediente 031) — metadatos pendientes de confirmar
- ⏳ PR a `main` cuando se estabilice la carga de datos

---

## ¿Qué no puedo romper?

| Invariante | Dónde está | ND |
|---|---|---|
| `claim_next_case_number()` escanea la tabla, no un contador persistente | `db.ts` → `supabase.rpc('claim_next_case_number')` | ND-46 |
| `deleteContractAction` borra el case si queda vacío de documentos | `contracts/actions/contracts.ts` | ND-46 |
| Vigencia usa `current_end_date ?? fecha_terminacion(INICIAL)` | `ContractsList.tsx` y `getEmployeeContractStatusAction` | ND-47 |
| `middleware.ts` usa `getClaims()`, no `getUser()` | `middleware.ts` | ND-13 |
| `contract-pdf.tsx` es BROWSER-ONLY — dynamic import only | `contracts/lib/contract-pdf.tsx` | ND-36 |
| Orden FK en deleteUserAction: `public.users` primero | `admin/actions/users.ts` | ND-42 |
| `pako` pinned a v1 en `package.json` overrides | `package.json` | ND-35 |

---

## ⚠️ Dato crítico de infraestructura

La app (`next dev` / Vercel) se conecta a **`qolnrtoznrgiedyhffbn.supabase.co`** (`.env.local`).
El MCP de Supabase disponible en esta sesión **solo tiene acceso a `ukzccqogkbfdtymmgavj`** (proyecto diferente).

**Consecuencia:** cualquier migración SQL debe correrse manualmente en el Dashboard del proyecto correcto (`qolnrtoznrgiedyhffbn`). No usar el MCP para verificar estado de producción — los resultados son del proyecto equivocado.

---

## Siguiente acción concreta

1. Continuar subiendo los contratos físicos desde `/contracts/new` (importar PDF firmado)
2. Confirmar metadatos del expediente 031 (Laura Ángela Ramírez Parra) y crearlo
3. Una vez todos los contratos estén cargados: commit + PR a `main`
4. Siguiente feature: por definir con el usuario

---

## Errores recientes a evitar
- No consultar el MCP de Supabase para verificar estado de producción — apunta al proyecto equivocado
- 502 de Supabase es transitorio — reintentar la operación, no buscar un bug de código
- `generate_series(1, 0)` devuelve cero filas — el gap-fill retorna correctamente NULL en ese caso, lo que produce el primer número `001`; no es un bug
- Pasar `React.ReactElement` como prop dentro de `<Text>` en react-pdf descarta páginas silenciosamente
