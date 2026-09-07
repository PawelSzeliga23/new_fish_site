import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto mt-20 max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Zaloguj się</h1>

      {params.error && (
        <p className="mb-4 rounded bg-red-100 p-2 text-sm text-red-700">
          {params.error}
        </p>
      )}
      {params.message && (
        <p className="mb-4 rounded bg-green-100 p-2 text-sm text-green-700">
          {params.message}
        </p>
      )}

      <form className="flex flex-col gap-3">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="rounded border px-3 py-2"
        />

        <label htmlFor="password">Hasło</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          className="rounded border px-3 py-2"
        />

        <div className="mt-4 flex gap-2">
          <button
            formAction={login}
            className="flex-1 rounded bg-blue-600 py-2 text-white"
          >
            Zaloguj
          </button>
          <button
            formAction={signup}
            className="flex-1 rounded border border-blue-600 py-2 text-blue-600"
          >
            Zarejestruj
          </button>
        </div>
      </form>
    </div>
  );
}
