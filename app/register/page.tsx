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
