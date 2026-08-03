# Empleos Hub — Foundation + Web (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the DB schema (Prisma + Neon), NextAuth Credentials login, and the Next.js hub feed (list, filter, search, save/applied/discarded state) — working end-to-end against seeded data, before the scraper exists.

**Architecture:** Next.js 16 App Router, server components query Postgres (Neon) via Prisma directly (no separate API layer needed since scraper writes are out-of-process). NextAuth (Auth.js) v5 with Credentials provider (email+password, bcrypt hash) and JWT session strategy — no separate session table. Job status mutations via Next.js Server Actions.

**Tech Stack:** Next.js 16, Prisma, Neon (Postgres), `next-auth` v5 (`@auth/core`), `bcryptjs`, Tailwind (already in project).

## Global Constraints

- Prisma/DB commands are explicitly authorized by the user for this project (see `docs/superpowers/specs/2026-08-03-empleos-hub-design.md`).
- Do not enable `cacheComponents` / `use cache` on the feed page — job data must be fetched fresh on every request (see Next.js 16 caching docs, `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`). Default (no directive) App Router behavior fetches fresh — leave it as-is.
- `userId` in `JobStatus` is the app's own `User.id` (Prisma model) — Neon has no built-in auth, so this project owns the `User` table.
- Passwords are hashed with bcrypt before storage — never store plaintext.
- This plan produces a working hub against **seeded** `Job` rows (Task 2 seeds sample data). The real scraper is Plan B, a separate plan.
- Neon connection string uses a single pooled `DATABASE_URL` (no separate `DIRECT_URL` — this project's Neon plan doesn't need it; `directUrl` is omitted from the datasource block).

---

### Task 1: Prisma schema + Supabase connection

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env.local.example`
- Modify: `.gitignore` (ensure `.env*.local` ignored — verify, Next.js template usually already has this)
- Create: `lib/prisma.ts`

**Interfaces:**
- Produces: `prisma` singleton export from `lib/prisma.ts` (`import { prisma } from "@/lib/prisma"`), `PrismaClient` typed with models `Job`, `User`, `JobStatus`, `Keyword`, enums `JobSource`, `JobStatusValue`.

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
DATABASE_URL="postgresql://user:password@host/db?sslmode=require&channel_binding=require"
NEXTAUTH_SECRET="[RANDOM_32_BYTE_SECRET]"
```

`NEXTAUTH_SECRET`: generate with `openssl rand -base64 32` (or ask the user). `.env.local` itself (with the real Neon `DATABASE_URL` the user provided) must already exist in the project root — verify it's present and gitignored before continuing; do not overwrite it if it already has a real `DATABASE_URL`, only add `NEXTAUTH_SECRET` if missing.

- [ ] **Step 3: Write the schema**

Replace `prisma/schema.prisma` contents:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
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

model User {
  id           String      @id @default(cuid())
  email        String      @unique
  passwordHash String
  createdAt    DateTime    @default(now())
  statuses     JobStatus[]
}

model JobStatus {
  id        String         @id @default(cuid())
  userId    String
  jobId     String
  status    JobStatusValue
  updatedAt DateTime       @updatedAt
  user      User           @relation(fields: [userId], references: [id])
  job       Job            @relation(fields: [jobId], references: [id])

  @@unique([userId, jobId])
}

model Keyword {
  id     String  @id @default(cuid())
  term   String  @unique
  active Boolean @default(true)
}
```

- [ ] **Step 4: Push schema to Neon and generate client**

Requires `.env.local` with the real Neon `DATABASE_URL` (already provided by the user).

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
git commit -m "feat: add Prisma schema and Neon connection"
```

Do NOT commit `.env.local` (must already be gitignored by the Next.js template — verify with `git check-ignore .env.local`, it should print the path).

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

### Task 3: NextAuth Credentials (login/register + session + route protection)

**Files:**
- Create: `auth.ts` (project root)
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `middleware.ts`
- Create: `app/login/page.tsx`
- Create: `app/login/actions.ts`
- Create: `app/register/page.tsx`
- Create: `app/register/actions.ts`

**Interfaces:**
- Produces: `auth()` (server-side session getter, `import { auth } from "@/auth"`, returns `Promise<{ user: { id: string; email: string } } | null>`), `signIn`/`signOut` server actions re-exported from `auth.ts`.
- Consumes: `prisma` from `lib/prisma.ts` (Task 1's `User` model), `NEXTAUTH_SECRET` env var.

- [ ] **Step 1: Install packages**

```bash
npm install next-auth@beta bcryptjs
npm install -D @types/bcryptjs
```

`next-auth@beta` is NextAuth v5 (Auth.js), which supports the `auth()` helper and Next.js 16 App Router middleware used below.

- [ ] **Step 2: Write `auth.ts`**

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
```

- [ ] **Step 3: Route handler**

`app/api/auth/[...nextauth]/route.ts`:

```ts
export { GET, POST } from "@/auth";
```

Wait — NextAuth v5 exports `handlers`, not `GET`/`POST` directly. Use:

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 4: Middleware to protect routes**

`middleware.ts` (project root):

```ts
export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|login|register).*)"],
};
```

This redirects unauthenticated requests to `/login` for any route not matched by the exclusion list (NextAuth v5's `auth` export doubles as middleware and redirects to the `pages.signIn` path from Step 2 when there's no session).

- [ ] **Step 5: Register page + action**

`app/register/actions.ts`:

```ts
"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export async function registerUser(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password || password.length < 8) {
    redirect("/register?error=" + encodeURIComponent("Email y password (min 8 caracteres) requeridos"));
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect("/register?error=" + encodeURIComponent("Ese email ya esta registrado"));
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, passwordHash } });

  redirect("/login?registered=1");
}
```

`app/register/page.tsx`:

```tsx
import { registerUser } from "./actions";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-xl font-semibold mb-4">Crear cuenta</h1>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <form action={registerUser} className="flex flex-col gap-3">
        <input type="email" name="email" required placeholder="tu@email.com" className="border rounded px-3 py-2" />
        <input type="password" name="password" required minLength={8} placeholder="Password (min 8 caracteres)" className="border rounded px-3 py-2" />
        <button type="submit" className="bg-black text-white rounded px-3 py-2">
          Registrarme
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 6: Login page + action**

`app/login/actions.ts`:

```ts
"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export async function loginWithCredentials(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect("/login?error=" + encodeURIComponent("Email o password incorrectos"));
    }
    throw err;
  }
}
```

`app/login/page.tsx`:

```tsx
import { loginWithCredentials } from "./actions";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; registered?: string }>;
}) {
  const { error, registered } = await searchParams;

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-xl font-semibold mb-4">Ingresar</h1>
      {registered && <p className="text-sm text-green-600 mb-4">Cuenta creada, ya podes ingresar.</p>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <form action={loginWithCredentials} className="flex flex-col gap-3">
        <input type="email" name="email" required placeholder="tu@email.com" className="border rounded px-3 py-2" />
        <input type="password" name="password" required placeholder="Password" className="border rounded px-3 py-2" />
        <button type="submit" className="bg-black text-white rounded px-3 py-2">
          Ingresar
        </button>
      </form>
      <p className="text-sm mt-4">
        No tenes cuenta? <Link href="/register" className="underline">Registrate</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 7: Manual verification**

```bash
npm run dev
```

Visit `http://localhost:3000` — expect redirect to `/login` (no session). Go to `/register`, create an account, expect redirect to `/login?registered=1`. Log in with those credentials, expect redirect to `/` while logged in. Confirm `prisma.user.findMany()` (via a throwaway `npx tsx -e` one-liner, same pattern as Task 1 Step 6) shows the new user with a bcrypt hash (not plaintext) in `passwordHash`.

- [ ] **Step 8: Commit**

```bash
git add auth.ts app/api/auth middleware.ts app/login app/register
git commit -m "feat: add NextAuth Credentials login/register with route protection"
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
- Consumes: `auth()` from `auth.ts` (Task 3), `prisma` from Task 1.
- Produces: `setJobStatus(jobId: string, status: JobStatusValue): Promise<void>` server action, exported from `app/jobs/actions.ts`.

- [ ] **Step 1: Write the server action**

`app/jobs/actions.ts`:

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { JobStatusValue } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function setJobStatus(jobId: string, status: JobStatusValue) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  await prisma.jobStatus.upsert({
    where: { userId_jobId: { userId: session.user.id, jobId } },
    create: { userId: session.user.id, jobId, status },
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

And in `app/page.tsx`, fetch the session before calling `getJobs` and pass `userId`:

```tsx
import { auth } from "@/auth";

// inside Home(), before getJobs call:
const session = await auth();
const jobs = await getJobs({
  source: params.source as JobSource | undefined,
  keyword: params.keyword || undefined,
  search: params.search || undefined,
  sort: params.sort === "oldest" ? "oldest" : "recent",
  userId: session?.user?.id,
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

- `npx prisma db push` applied, schema live on Neon.
- Seeded keywords + jobs visible.
- Register + login via email/password works, unauthenticated users redirected to `/login`.
- Feed lists jobs, filterable by source/keyword/search, sortable by date.
- Save/Applied/Discarded buttons persist per-user state.

**Not covered here (Plan B):** the actual scraper modules (Reddit/Computrabajo/ZonaJobs/LinkedIn) and the runner/cron that populates real `Job` rows.
