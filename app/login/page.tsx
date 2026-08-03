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
