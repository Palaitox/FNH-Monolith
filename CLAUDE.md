# FNH Monolith — Project Instructions for Claude

## Fuentes de verdad (leer antes de tocar)

| Qué necesitas saber | Dónde está |
|---|---|
| Decisiones arquitectónicas con rationale | `decisions.md.md` (ND-1 … ND-43+) |
| Diseño del sistema, schema, componentes | `systemDesignFinal.md.md` |
| Historial por fases y estado actual | `implementation_plan.md.md` |
| Estado operativo de la sesión en curso | `docs/session-handoff.md` |
| Schema SQL canónico | `Schema.sql.md` |

**Regla:** Si una decisión ya existe en `decisions.md.md`, no la reinventes. Cítala por ID (ND-XX).

---

## Límites arquitectónicos — no cruzar sin revisar la decisión

- `contracts/lib/contract-pdf.tsx` y `signature_pad` son **BROWSER-ONLY** — nunca importar en Server Components ni Server Actions (ND-36)
- `middleware.ts` usa `getClaims()` no `getUser()` — no cambiar sin leer ND-13
- `DISTINCT ON` está replicado en JS intencionalmente — no mover a DB sin leer ND-14
- `public.users` se borra antes que `auth.users` en delete — FK order, ver ND-42
- Módulos solo importan desde `(shared)/` — boundaries enforced por ESLint (ND-2)

---

## Stack

- Next.js 15 App Router — TypeScript first
- Supabase (PostgreSQL + Auth + Storage)
- Vercel (hosting) + Resend (email)
- `@react-pdf/renderer` v4 — PDF generado en browser, nunca en servidor
- `pako` pinned a v1 via `overrides` en `package.json` — no actualizar (ND-35)

---

## Convenciones del repo

- Páginas de mutación tienen guard de rol: `page.tsx` = Server Component que verifica rol y redirige; lógica en `*Form.tsx` o `*Detail.tsx`
- Server Actions siempre en `actions/` con `'use server'`
- Padding de contenedor: `px-4 py-6 sm:px-6` (nunca `p-6`) — ver ND-40
- Nueva decisión → formato `| ND-XX | decisión | rationale |` en `decisions.md.md`

---

## Comandos frecuentes

```bash
npx tsc --noEmit          # verificar tipos sin build
npx next dev              # dev server
```

---

## Protocolo de cierre de sesión

Al terminar un bloque de trabajo:
1. Yo (Claude) propongo el texto de actualización para `docs/session-handoff.md` y cualquier nueva entrada en backbone docs
2. Tú revisas y apruebas
3. Yo escribo solo lo aprobado

**Auto memory:** solo para preferencias de trabajo tuyas (estilo de respuesta, qué evitar). Nunca para decisiones del sistema ni estado del proyecto — eso va a archivos versionados.
