# Empleos Hub — Foundation + Web (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the DB schema (Prisma + Supabase), Supabase Auth, and the Next.js hub feed (list, filter, search, save/applied/discarded state) — working end-to-end against seeded data, before the scraper exists.

**Architecture:** Next.js 16 App Router, server components query Postgres via Prisma directly (no separate API layer needed since scraper writes are out-of-process). Supabase Auth via `@supabase/ssr` for session handling in server components/middleware. Job status mutations via Next.js Server Actions.

**Tech Stack:** Next.js 16, Prisma, Supabase (Postgres + Auth), `@supabase/ssr`, `@supabase/supabase-js`, Tailwind (already in project).

## Global Constraints

- Prisma/DB commands are explicitly authorized by the user for this project (see `docs/superpowers/specs/2026-08-03-empleos-hub-design.md`).
- Do not enable `cacheComponents` / `use cache` on the feed page — job data must be fetched fresh on every request (see Next.js 16 caching docs, `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`). Default (no directive) App Router behavior fetches fresh — leave it as-is.
- `userId` in `JobStatus` is the Supabase Auth user id — there is no local `User` table.
- This plan produces a working hub against **seeded** `Job` rows (Task 2 seeds sample data). The real scraper is Plan B, a separate plan.

---

### Task 1: Prisma schema + Supabase connection

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env.local.example`
- Modify: `.gitignore` (ensure `.env*.local` ignored — verify, Next.js template usually already has this)
- Create: `lib/prisma.ts`

**Interfaces:**
- Produces: `prisma` singleton export from `lib/prisma.ts` (`import { prisma } from "@/lib/prisma"`), `PrismaClient` typed with models `Job`, `JobStatus`, `Keyword`, enums `JobSource`, `JobStatusValue`.

- [ ] **Step 1: Install dependencies**

```bash
npm install prisma @prisma/client --save
npm install prisma --save-dev
```

- [ ] **Step 2: Init Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and `.env`. Delete the generated `.env` (we use `.env.local` for Next.js convention) and instead create `.env.local.example`:

```
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[ANON_KEY]"
```

Tell the user to copy this to `.env.local` and fill in real Supabase project values (Supabase dashboard → Project Settings → Database / API).

- [ ] **Step 3: Write the schema**

Replace `prisma/schema.prisma` contents:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

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
  id             String      @id @default(cuid())
  source         JobSource
  externalId     String
  title          String
  company        String?
  url            String
  location       String?
  postedAt       DateTime?
  keywordMatched String
  scrapedAt      DateTime    @default(now())
  statuses       JobStatus[]

  @@unique([source, externalId])
}

model JobStatus {
  id        String         @id @default(cuid())
  userId    String
  jobId     String
  status    JobStatusValue
  updatedAt DateTime       @updatedAt
  job       Job            @relation(fields: [jobId], references: [id])

  @@unique([userId, jobId])
}

model Keyword {
  id     String  @id @default(cuid())
  term   String  @unique
  active Boolean @default(true)
}
```

- [ ] **Step 4: Push schema to Supabase and generate client**

Requires `.env.local` filled with real Supabase credentials first (ask user if not yet done).

```bash
npx prisma db push
npx prisma generate
```

Expected: "Your database is now in sync with your Prisma schema" and client generated with no errors.

- [ ] **Step 5: Create the Prisma singleton**

`lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 6: Verify connectivity**

Create a throwaway script `scripts/verify-db.ts`:

```ts
import { prisma } from "../lib/prisma";

async function main() {
  const count = await prisma.job.count();
  console.log("Job count:", count);
}

main().finally(() => prisma.$disconnect());
```

Run: `npx tsx scripts/verify-db.ts` (install `tsx` as dev dep if missing: `npm install -D tsx`)
Expected: `Job count: 0` — no errors.

Delete `scripts/verify-db.ts` after confirming (it's a one-off check, not part of the app).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma lib/prisma.ts .env.local.example package.json package-lock.json
git commit -m "feat: add Prisma schema and Supabase connection"
```

---

### Task 2: Seed script (Keywords + sample Jobs)

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add `prisma.seed` config)

**Interfaces:**
- Consumes: `prisma` from `lib/prisma.ts`, `JobSource`/`JobStatusValue` enums from `@prisma/client`.
- Produces: seeded `Keyword` rows and sample `Job` rows so Task 4/5/6 have data to render against.

- [ ] **Step 1: Write the seed script**

`prisma/seed.ts`:

```ts
import { PrismaClient, JobSource } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.keyword.createMany({
    data: [
      { term: "react" },
      { term: "administrativo" },
      { term: "atencion al cliente" },
    ],
    skipDuplicates: true,
  });

  await prisma.job.createMany({
    data: [
      {
        source: JobSource.REDDIT,
        externalId: "seed-reddit-1",
        title: "Se busca dev React jr",
        company: "Startup AR",
        url: "https://reddit.com/r/empleos/example1",
        location: "CABA",
        postedAt: new Date(),
        keywordMatched: "react",
      },
      {
        source: JobSource.COMPUTRABAJO,
        externalId: "seed-ct-1",
        title: "Administrativo contable",
        company: "Empresa SA",
        url: "https://computrabajo.com.ar/example2",
        location: "Cordoba",
        postedAt: new Date(),
        keywordMatched: "administrativo",
      },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Wire the seed command**

Add to `package.json` (top level, sibling of `scripts`):

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 3: Run the seed**

```bash
npx prisma db seed
```

Expected: no errors, exits 0.

- [ ] **Step 4: Verify**

```bash
npx tsx -e "import('./lib/prisma').then(async ({prisma}) => { console.log(await prisma.job.count(), await prisma.keyword.count()); await prisma.\$disconnect(); })"
```

Expected: `2 3` (2 jobs, 3 keywords).

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add Prisma seed script with sample keywords and jobs"
```

---

### Task 3: Supabase Auth (login/logout + session helpers)

**Files:**
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/client.ts`
- Create: `middleware.ts`
- Create: `app/login/page.tsx`
- Create: `app/login/actions.ts`
- Create: `app/auth/callback/route.ts`

**Interfaces:**
- Produces: `createServerSupabaseClient()` (async, reads cookies, for use in server components/actions), `createBrowserSupabaseClient()` (for client components), middleware that refreshes the Supabase session cookie on every request.
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars from Task 1.

- [ ] **Step 1: Install Supabase packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Server client helper**

`lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component with no write access; middleware handles refresh
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Browser client helper**

`lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Middleware to refresh session + protect routes**

`middleware.ts` (project root):

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth/callback).*)"],
};
```

- [ ] **Step 5: Login page + server action**

`app/login/actions.ts`:

```ts
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signInWithEmail(formData: FormData) {
  const email = formData.get("email") as string;
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?sent=1");
}
```

`app/login/page.tsx`:

```tsx
import { signInWithEmail } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-xl font-semibold mb-4">Ingresar</h1>
      {sent && <p className="text-sm text-green-600 mb-4">Revisa tu email para el link de acceso.</p>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <form action={signInWithEmail} className="flex flex-col gap-3">
        <input
          type="email"
          name="email"
          required
          placeholder="tu@email.com"
          className="border rounded px-3 py-2"
        />
        <button type="submit" className="bg-black text-white rounded px-3 py-2">
          Enviar link de acceso
        </button>
      </form>
    </main>
  );
}
```

Uses Supabase magic-link (email OTP) auth — no password to manage.

- [ ] **Step 6: Auth callback route**

`app/auth/callback/route.ts`:

```ts
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/`);
}
```

- [ ] **Step 7: Manual verification**

```bash
npm run dev
```

Visit `http://localhost:3000` — expect redirect to `/login` (no session). Submit real email, check inbox for magic link, click it, expect redirect to `/` while logged in (verify via a temporary `console.log` of `supabase.auth.getUser()` in `app/page.tsx`, remove after confirming).

- [ ] **Step 8: Commit**

```bash
git add lib/supabase middleware.ts app/login app/auth
git commit -m "feat: add Supabase Auth (magic link login) with route protection"
```

---

### Task 4: Feed page (list jobs)

**Files:**
- Modify: `app/page.tsx`
- Create: `lib/jobs.ts`

**Interfaces:**
- Consumes: `prisma` from `lib/prisma.ts`.
- Produces: `getJobs(filters: JobFilters): Promise<Job[]>` from `lib/jobs.ts`, where `JobFilters = { source?: JobSource; keyword?: string; search?: string }`. Later tasks (5, 6) extend this signature and the same file.

- [ ] **Step 1: Write `lib/jobs.ts`**

```ts
import { prisma } from "@/lib/prisma";
import type { JobSource } from "@prisma/client";

export type JobFilters = {
  source?: JobSource;
  keyword?: string;
  search?: string;
};

export async function getJobs(filters: JobFilters = {}) {
  return prisma.job.findMany({
    where: {
      source: filters.source,
      keywordMatched: filters.keyword,
      title: filters.search
        ? { contains: filters.search, mode: "insensitive" }
        : undefined,
    },
    orderBy: { postedAt: "desc" },
    include: { statuses: true },
  });
}
```

- [ ] **Step 2: Replace `app/page.tsx` with the feed**

```tsx
import { getJobs } from "@/lib/jobs";

export default async function Home() {
  const jobs = await getJobs();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold mb-6">Empleos Argentina</h1>
      <ul className="flex flex-col gap-4">
        {jobs.map((job) => (
          <li key={job.id} className="border rounded p-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-medium">{job.title}</h2>
                <p className="text-sm text-gray-600">
                  {job.company} — {job.location}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {job.source} · {job.keywordMatched}
                </p>
              </div>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline shrink-0"
              >
                Ver original
              </a>
            </div>
          </li>
        ))}
      </ul>
      {jobs.length === 0 && (
        <p className="text-gray-500">No hay avisos todavia.</p>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

Visit `http://localhost:3000` (logged in from Task 3) — expect the 2 seeded jobs listed with title, company, location, source, keyword, and a working "Ver original" link.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx lib/jobs.ts
git commit -m "feat: render job feed from seeded Prisma data"
```

---

### Task 5: Filters, search, sort

**Files:**
- Modify: `lib/jobs.ts` (add `sort` to `JobFilters`)
- Modify: `app/page.tsx` (read `searchParams`, add filter UI)

**Interfaces:**
- Consumes: `getJobs(filters: JobFilters)` from Task 4.
- Produces: `JobFilters` extended with `sort?: "recent" | "oldest"`. `app/page.tsx` now reads `searchParams` and passes a GET form for filters — no client JS needed.

- [ ] **Step 1: Extend `lib/jobs.ts`**

```ts
import { prisma } from "@/lib/prisma";
import type { JobSource } from "@prisma/client";

export type JobFilters = {
  source?: JobSource;
  keyword?: string;
  search?: string;
  sort?: "recent" | "oldest";
};

export async function getJobs(filters: JobFilters = {}) {
  return prisma.job.findMany({
    where: {
      source: filters.source,
      keywordMatched: filters.keyword,
      title: filters.search
        ? { contains: filters.search, mode: "insensitive" }
        : undefined,
    },
    orderBy: { postedAt: filters.sort === "oldest" ? "asc" : "desc" },
    include: { statuses: true },
  });
}
```

- [ ] **Step 2: Update `app/page.tsx` to read searchParams and add a filter form**

```tsx
import { getJobs } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import type { JobSource } from "@prisma/client";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    keyword?: string;
    search?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const jobs = await getJobs({
    source: params.source as JobSource | undefined,
    keyword: params.keyword || undefined,
    search: params.search || undefined,
    sort: params.sort === "oldest" ? "oldest" : "recent",
  });
  const keywords = await prisma.keyword.findMany({ where: { active: true } });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold mb-6">Empleos Argentina</h1>

      <form className="flex flex-wrap gap-2 mb-6" method="get">
        <input
          type="text"
          name="search"
          defaultValue={params.search}
          placeholder="Buscar..."
          className="border rounded px-3 py-1 text-sm"
        />
        <select name="source" defaultValue={params.source} className="border rounded px-2 py-1 text-sm">
          <option value="">Todas las fuentes</option>
          <option value="LINKEDIN">LinkedIn</option>
          <option value="COMPUTRABAJO">Computrabajo</option>
          <option value="ZONAJOBS">ZonaJobs</option>
          <option value="REDDIT">Reddit</option>
        </select>
        <select name="keyword" defaultValue={params.keyword} className="border rounded px-2 py-1 text-sm">
          <option value="">Todas las keywords</option>
          {keywords.map((k) => (
            <option key={k.id} value={k.term}>
              {k.term}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={params.sort} className="border rounded px-2 py-1 text-sm">
          <option value="recent">Mas recientes</option>
          <option value="oldest">Mas antiguos</option>
        </select>
        <button type="submit" className="bg-black text-white rounded px-3 py-1 text-sm">
          Filtrar
        </button>
      </form>

      <ul className="flex flex-col gap-4">
        {jobs.map((job) => (
          <li key={job.id} className="border rounded p-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-medium">{job.title}</h2>
                <p className="text-sm text-gray-600">
                  {job.company} — {job.location}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {job.source} · {job.keywordMatched}
                </p>
              </div>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline shrink-0"
              >
                Ver original
              </a>
            </div>
          </li>
        ))}
      </ul>
      {jobs.length === 0 && <p className="text-gray-500">No hay avisos todavia.</p>}
    </main>
  );
}
```

- [ ] **Step 3: Manual verification**

`npm run dev`, visit `/?source=REDDIT` — expect only the seeded Reddit job. Visit `/?search=administrativo` — expect only the Computrabajo job. Visit `/?sort=oldest` — expect order unaffected by 2 items but no error.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx lib/jobs.ts
git commit -m "feat: add source/keyword/search/sort filters to job feed"
```

---

### Task 6: Job status (save/applied/discarded)

**Files:**
- Create: `app/jobs/actions.ts`
- Modify: `app/page.tsx` (render status buttons per job)

**Interfaces:**
- Consumes: `createServerSupabaseClient()` from Task 3, `prisma` from Task 1.
- Produces: `setJobStatus(jobId: string, status: JobStatusValue): Promise<void>` server action, exported from `app/jobs/actions.ts`.

- [ ] **Step 1: Write the server action**

`app/jobs/actions.ts`:

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { JobStatusValue } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function setJobStatus(jobId: string, status: JobStatusValue) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  await prisma.jobStatus.upsert({
    where: { userId_jobId: { userId: user.id, jobId } },
    create: { userId: user.id, jobId, status },
    update: { status },
  });

  revalidatePath("/");
}
```

- [ ] **Step 2: Add status buttons to `app/page.tsx`**

Add import and render a small form per status per job (inside the `<li>`, after the existing content):

```tsx
import { setJobStatus } from "@/app/jobs/actions";
import { JobStatusValue } from "@prisma/client";
```

Inside the `<li>` map, after the existing `<div className="flex justify-between items-start">...</div>`, add:

```tsx
            <div className="flex gap-2 mt-3">
              {(["SAVED", "APPLIED", "DISCARDED"] as JobStatusValue[]).map((status) => (
                <form
                  key={status}
                  action={async () => {
                    "use server";
                    await setJobStatus(job.id, status);
                  }}
                >
                  <button
                    type="submit"
                    className={`text-xs border rounded px-2 py-1 ${
                      job.statuses[0]?.status === status ? "bg-black text-white" : ""
                    }`}
                  >
                    {status === "SAVED" ? "Guardar" : status === "APPLIED" ? "Aplicado" : "Descartar"}
                  </button>
                </form>
              ))}
            </div>
```

Note: `job.statuses` from `getJobs` currently includes statuses for *all* users, not just the current one — fix `lib/jobs.ts` to filter by the current user.

- [ ] **Step 3: Fix `getJobs` to scope statuses to the current user**

Update `lib/jobs.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { JobSource } from "@prisma/client";

export type JobFilters = {
  source?: JobSource;
  keyword?: string;
  search?: string;
  sort?: "recent" | "oldest";
  userId?: string;
};

export async function getJobs(filters: JobFilters = {}) {
  return prisma.job.findMany({
    where: {
      source: filters.source,
      keywordMatched: filters.keyword,
      title: filters.search
        ? { contains: filters.search, mode: "insensitive" }
        : undefined,
    },
    orderBy: { postedAt: filters.sort === "oldest" ? "asc" : "desc" },
    include: {
      statuses: filters.userId ? { where: { userId: filters.userId } } : false,
    },
  });
}
```

And in `app/page.tsx`, fetch the user before calling `getJobs` and pass `userId`:

```tsx
import { createServerSupabaseClient } from "@/lib/supabase/server";

// inside Home(), before getJobs call:
const supabase = await createServerSupabaseClient();
const { data: { user } } = await supabase.auth.getUser();
const jobs = await getJobs({
  source: params.source as JobSource | undefined,
  keyword: params.keyword || undefined,
  search: params.search || undefined,
  sort: params.sort === "oldest" ? "oldest" : "recent",
  userId: user?.id,
});
```

- [ ] **Step 4: Manual verification**

`npm run dev`, click "Guardar" on a job — expect the button to highlight (black background) after the page reloads, and it persists on refresh. Click "Aplicado" — expect it to switch (only one active status per job per user, enforced by the `@@unique([userId, jobId])` constraint + upsert).

- [ ] **Step 5: Commit**

```bash
git add app/jobs app/page.tsx lib/jobs.ts
git commit -m "feat: add save/applied/discarded status per job via server actions"
```

---

## Definition of Done

- `npx prisma db push` applied, schema live on Supabase.
- Seeded keywords + jobs visible.
- Login via magic link works, unauthenticated users redirected to `/login`.
- Feed lists jobs, filterable by source/keyword/search, sortable by date.
- Save/Applied/Discarded buttons persist per-user state.

**Not covered here (Plan B):** the actual scraper modules (Reddit/Computrabajo/ZonaJobs/LinkedIn) and the runner/cron that populates real `Job` rows.
