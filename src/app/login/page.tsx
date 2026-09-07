import { login, signup } from "./actions";
import { card, heading, input, btnPrimary, btnSecondary } from "@/lib/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className={`${card} mx-auto mt-20 max-w-sm`}>
      <h1 className={`${heading} mb-6`}>Zaloguj się</h1>

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
          className={input}
        />

        <label htmlFor="password">Hasło</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          className={input}
        />

        <div className="mt-4 flex gap-2">
          <button
            formAction={login}
            className={`${btnPrimary} flex-1`}
          >
            Zaloguj
          </button>
          <button
            formAction={signup}
            className={`${btnSecondary} flex-1`}
          >
            Zarejestruj
          </button>
        </div>
      </form>
    </div>
  );
}
