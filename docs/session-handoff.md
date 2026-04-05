# Session Handoff — FNH Monolith

> Actualizar al cerrar cada bloque de trabajo. Máximo ~500 palabras. El historial detallado vive en `implementation_plan.md.md`.

---

## Objetivo actual
Completar Phase 13 (mejoras de UX y arquitectura de sesión), incluyendo la plantilla "Otro Sí", refuerzo de rol viewer, y este sistema de memoria recursiva.

## Estado real hoy (2026-04-05)

- **Phase 13 en curso** — la mayoría de items completados:
  - ✅ Hard delete de usuarios (ND-42)
  - ✅ Fix invite flow — `/auth/invite` Client Component (ND-43)
  - ✅ Rol viewer: guards en todas las páginas de mutación + UI gated
  - ✅ Botones "← Volver" en empleados, conductores, vehículos, verificación
  - ✅ Panel de Buses: hover mejorado en cards, botones redundantes eliminados
  - ✅ "Otro Sí" como 4° tipo de contrato — 2 páginas, texto verbatim del template
  - ✅ Arquitectura de sesión: CLAUDE.md + docs/session-handoff.md + Quick Orientation + Snapshot

- **Pendiente confirmación:** que el PDF "Otro Sí" genere correctamente las dos páginas en producción (el usuario lo va a probar)

## Decisiones nuevas esta sesión
- ND-44 (pendiente de registrar formalmente): `otro_si` como 4° tipo en `generateContractPdf`; `trabajador_jornada?` añadido a `ContractVars`; `fechaTerminacion` oculto en el form cuando tipo = `otro_si`

## Archivos a leer primero en la próxima sesión
1. `docs/session-handoff.md` (este archivo)
2. `implementation_plan.md.md` — sección "Current State Snapshot"
3. `app/contracts/lib/contract-pdf.tsx` si hay issues con el Otro Sí

## Cosas que no deben romperse
- `middleware.ts` — usa `getClaims()`, no tocar sin leer ND-13
- `contract-pdf.tsx` — BROWSER-ONLY, no importar en server sin dynamic import
- Orden FK en deleteUserAction: `public.users` primero, luego `auth.users`
- `pako` pinned a v1 en `package.json` overrides — no actualizar

## Siguiente acción concreta
Verificar con el usuario que el PDF "Otro Sí" genera 2 páginas correctamente. Si hay issues, revisar que `<Page>` múltiples dentro de `<Document>` en react-pdf no tengan componentes internos con hooks (los componentes inline como `HeaderTable`, `ClosingParagraph` funcionan como funciones, no como componentes React — correcto en react-pdf).

## Errores recientes a evitar
- Pasar `React.ReactElement` como prop dentro de `<Text>` en react-pdf → silenciosamente descarta páginas. Solución: inlinear todo el texto directamente.
- No copiar texto de PDFs con OCR sin verificar — el agente de extracción sobre el PDF da resultados más fiables que leer directamente.
