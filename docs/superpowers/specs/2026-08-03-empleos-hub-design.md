# Hub de empleos Argentina — Design

Fecha: 2026-08-03

## Objetivo
Agregar en un solo lugar avisos laborales del mercado argentino recolectados de LinkedIn Empleos, Computrabajo, ZonaJobs y Reddit r/empleos, filtrados por keywords configurables, con login y estado por usuario (guardado/aplicado/descartado).

## Decisiones (de brainstorming)
- Recolección: scraping automático (no APIs oficiales — no existen para LinkedIn/Computrabajo/ZonaJobs de empleos).
- Ejecución: script Node separado del hosting de Next.js, corre con cron local (no Vercel Cron).
- Storage: Supabase (Postgres) + Prisma. Permiso explícito del usuario otorgado para uso de Prisma/comandos DB en este proyecto.
- Alcance de avisos: filtrado por lista de keywords configurable (no todo el mercado, no un rubro fijo hardcodeado).
- Auth: Supabase Auth (login real, no local-only).
- Features hub: feed + filtro por fuente + filtro por keyword + búsqueda texto libre + orden por fecha + estado por aviso (guardado/aplicado/descartado).

## Arquitectura

```
[Scraper Node (cron local)] --upsert--> [Supabase Postgres via Prisma] <--query-- [Next.js hub (Vercel/local)]
                                                                                        |
                                                                                  [Supabase Auth]
```

Dos codebases dentro del mismo repo: `app/` (hub Next.js existente) y un nuevo `scraper/` (script Node standalone, mismo Prisma client/schema compartido).

## Modelo de datos (Prisma)

```prisma
enum JobSource {
  LINKEDIN
  COMPUTRABAJO
  ZONAJOBS
  REDDIT
}

enum JobStatusValue {
  SAVED
  APPLIED
  DISCARDED
}

model Job {
  id            String    @id @default(cuid())
  source        JobSource
  externalId    String
  title         String
  company       String?
  url           String
  location      String?
  postedAt      DateTime?
  keywordMatched String
  scrapedAt     DateTime  @default(now())
  statuses      JobStatus[]

  @@unique([source, externalId])
}

model JobStatus {
  id        String          @id @default(cuid())
  userId    String
  jobId     String
  status    JobStatusValue
  updatedAt DateTime        @updatedAt
  job       Job             @relation(fields: [jobId], references: [id])

  @@unique([userId, jobId])
}

model Keyword {
  id     String  @id @default(cuid())
  term   String  @unique
  active Boolean @default(true)
}
```

`userId` referencia al `id` de Supabase Auth (no hay tabla `User` propia — Supabase la maneja).

## Scraper

Un módulo por fuente, todas exponen `scrape(keyword: string): Promise<RawJob[]>`, corridas orquestadas por un runner central que itera keywords activas (tabla `Keyword`) x fuentes.

- **Reddit r/empleos**: `fetch` a `https://www.reddit.com/r/empleos/search.json?q=<keyword>&restrict_sr=1&sort=new`. Sin auth. Mapear post → RawJob (title=post title, url=permalink, postedAt=created_utc).
- **Computrabajo**: `fetch` HTML de resultados de búsqueda + `cheerio` para parsear listado. Server-rendered, sin login.
- **ZonaJobs**: igual método que Computrabajo, `fetch` + `cheerio`.
- **LinkedIn Empleos**: requiere sesión logueada + JS dinámico → Playwright headless con cookies de sesión persistidas en disco (fuera de git). Es la fuente más frágil: cambios de HTML/anti-bot rompen el scraper primero acá. Falla aislada, no bloquea las otras 3 fuentes.

Runner: por cada (keyword, fuente) llama `scrape`, upsert en `Job` por `(source, externalId)` (ignora si ya existe), catch por fuente individual (loguea error y sigue con la siguiente, no aborta la corrida).

`externalId`: id nativo del posteo si la fuente lo expone (Reddit post id), si no, hash del `url`.

## Hub web (Next.js, `app/`)

- Ruta de login (Supabase Auth, email+password o magic link — a definir en plan).
- Página feed: lista de `Job` con filtros (fuente, keyword, texto libre) y orden por `postedAt` desc. Query directa a Supabase vía Prisma desde server components.
- Por cada `Job`: botones guardar/aplicado/descartado que hacen upsert en `JobStatus` para el usuario logueado. Link "ver original" (`Job.url`, target _blank).
- Página opcional de administración de keywords (alta/baja en tabla `Keyword`) — a confirmar prioridad en plan.

## Manejo de errores
- Scraper: error en una fuente no aborta la corrida completa; se loguea (consola/archivo) y continúa con las demás fuentes/keywords.
- Hub: si falla la query a Supabase, mostrar estado de error simple en la página, sin crash.

## Fuera de alcance (explícito)
- No hay notificaciones push/email de nuevos avisos.
- No hay multiusuario colaborativo más allá de login individual con estado propio.
- No hay deploy automatizado del scraper (corre local, manual/cron del usuario).
