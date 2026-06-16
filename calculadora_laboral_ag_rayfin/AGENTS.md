# AGENTS.md

This project ships Rayfin agent context.
Load `.agents/skills/rayfin/SKILL.md` and the `rayfin` MCP server in `.mcp.json` before writing Rayfin code.

## ⚠️ Experimental features

This template uses two **experimental** Rayfin features that may change or break:

1. **Username/password authentication** — uses `client.auth.signIn/signUp({ email, password })` rather than the production Fabric brokered auth flow. The API surface is not yet stable and may not be fully documented.
2. **Docker local hosting (`rayfin dev`)** — runs the full Rayfin backend locally in Docker containers. Requires the `RAYFIN_FEATURE_FLAGS=docker-local-dev` feature flag and the `RAYFIN_WEBSERVICE_IMAGE_NAME` env var (set automatically by npm scripts).

When working with auth code, refer to the existing `RayfinAuthService` implementation rather than MCP docs, since the password auth API may not be documented yet.

## Development workflows

Three modes are available:

- **`npm run dev:local`** — Full local. Runs the Rayfin backend in Docker, generates env, starts Vite.
- **`npm run dev:local:stop`** — Stop local Docker containers (keeps data).
- **`npm run dev:local:down`** — Remove local Docker containers (keeps volumes).
- **`npm run dev:local:purge`** — Purge containers and volumes (full reset).
- **`npm run dev`** — Cloud backend. Deploys to Fabric (`rayfin up`), starts Vite against the remote API.
- **`npm run up`** — Deploy only. Deploys to Fabric without a local dev server.

### Running `rayfin dev` commands

Use `npm run rayfin:dev` to invoke `rayfin dev` with the required feature flag already set:

```bash
npm run rayfin:dev             # start Docker containers
npm run rayfin:dev -- status   # check container status
npm run dev:local:stop         # stop containers
npm run dev:local:down         # remove containers
npm run dev:local:purge        # purge containers and volumes
npm run rayfin:db              # apply database migrations
```

If invoking `rayfin dev` directly (without npm scripts), you **must** set the feature flag:

```bash
RAYFIN_FEATURE_FLAGS=docker-local-dev rayfin dev [options]
```

## Rayfin docs

Rayfin docs are version-locked to the packages installed in this project.
Prefer the MCP tools `search_docs`, `get_doc`, `list_docs`, and `discover_packages` for examples, API details, and troubleshooting.
If MCP is unavailable, run `rayfin docs ...` from the project root so the CLI reads this project's `node_modules`.
If `rayfin` is not on `PATH`, use `npx -y @microsoft/rayfin-cli docs ...` from the project root.

Use `discover_packages` or `rayfin docs discover <topic>` when installed docs do not cover the task.

---

## Contexto del Proyecto: Calculadora Laboral

### Fórmulas y leyes laborales procesadas

Toda la lógica reside en el `useMemo` llamado `calculationsData` dentro de [`HomePage.tsx`](src/pages/HomePage.tsx) (L170–L337).

| Concepto | Base legal | Tasa / fórmula |
|---|---|---|
| Prima de Servicios | CST Art. 306 | `(salary + auxTransport) × 0.0833` |
| Cesantías | CST Art. 249 | `(salary + auxTransport) × 0.0833` |
| Intereses sobre Cesantías | Ley 52/1975 | `cesantías × 0.12` |
| Vacaciones | CST Art. 186 | `baseVacaciones × 0.0417` |
| Salud empleador | Ley 1607/2012, Art. 114-1 ET | `IBC × 0.085` (0 si exento) |
| Pensión empleador | Ley 100/1993 | `IBC × 0.12` |
| ARL | Decreto 1607/2002 | `IBC × tasa_clase` (I=0.522 % … V=6.96 %) |
| Caja de Compensación | Ley 21/1982 | `base × 0.04` |
| SENA | Ley 119/1994 | `base × 0.02` (0 si exento) |
| ICBF | Ley 89/1988 | `base × 0.03` (0 si exento) |
| Salud trabajador | — | `IBC × 0.04` |
| Pensión trabajador | — | `IBC × 0.04` |
| Fondo de Solidaridad Pensional | Ley 100 Art. 27 | escalonado 1 %–2 % sobre IBC ≥ 4 SMMLV |
| **Aprendiz SENA – Lectiva** | Ley 2466/2025 Reforma Laboral | 75 % SMMLV, empresa asume 100 % salud (12.5 %), sin prestaciones ni pensión |
| **Aprendiz SENA – Productiva** | Ley 2466/2025 Reforma Laboral | 100 % SMMLV + auxilio transporte, prestaciones completas, Salud+Pensión repartida |

**IBC capping:** `min(max(rawIbc, SMMLV), SMMLV × 25)`. Salario integral: factor prestacional = 70 %.

### Mapa de decoradores Rayfin — entidad `Calculation`

Archivo: [`rayfin/data/Calculation.ts`](rayfin/data/Calculation.ts)

| Campo | Decorador actual | Notas |
|---|---|---|
| `id` | `@uuid()` | ✅ PK |
| `name` | `@text({ min:1, max:100 })` | ✅ |
| `salary` | `@int()` | ✅ Salario en COP (entero) |
| `smmlv` | `@int()` | ✅ SMMLV vigente |
| `auxTransport` | `@int()` | ✅ Auxilio de transporte |
| `isIntegral` | `@boolean()` | ✅ |
| `arlClass` | `@int()` | ✅ Clase 1–5 |
| `isExempt` | `@boolean()` | ✅ Exoneración Art. 114-1 ET |
| `isSena` | `@boolean({ optional:true })` | ✅ |
| `senaStage` | `@text({ optional:true, max:20 })` | ✅ `'lectiva'` \| `'productiva'` |
| `createdAt` | `@date()` | ✅ |
| `user_id` | `@text()` | ✅ `claims.sub` (RLS policy) |

**Pendiente/necesario [v2.0]:** los valores monetarios calculados (prima, cesantías, totalCostToEmployer, etc.) se derivan en memoria y **no se persisten**. Si se quiere guardar resultados calculados habría que agregar campos `@decimal()` (p.ej. `totalCostToEmployer`, `netToReceive`) — hoy solo se guardan los parámetros de entrada como `@int()`.

**Seguridad:** `@role('authenticated', '*', { policy: (claims, item) => claims.sub.eq(item.user_id) })` — RLS por usuario activo. ✅

### Punto exacto del frontend donde nos quedamos

- **Componente activo:** [`src/pages/HomePage.tsx`](src/pages/HomePage.tsx)
- **Estado de la UI:** completo y funcional — inputs (salario, SMMLV, auxilio, tipo, ARL, exoneración), resultados en tiempo real, guardado en Rayfin, historial con carga/eliminación.
- **Servicio de datos:** [`src/services/calculations.ts`](src/services/calculations.ts) — CRUD contra `client.data.Calculation` (select, create, delete).
- **Próximo paso sugerido:** expandir la entidad con campos `@decimal()` para persistir resultados calculados, o agregar filtros/comparación en el historial de cálculos guardados.

