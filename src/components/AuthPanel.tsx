"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Dices, Check, X, Loader2 } from "lucide-react";
import { login, signup, checkUsername, type AuthState } from "@/app/login/actions";
import { randomUsername, USERNAME_PATTERN, USERNAME_HINT } from "@/lib/username";
import { input, btnPrimary } from "@/lib/ui";

const GENDERS = [
  { value: "male", label: "Mężczyzna" },
  { value: "female", label: "Kobieta" },
  { value: "other", label: "Inna" },
  { value: "undisclosed", label: "Wolę nie podawać" },
];

/** Najpóźniejsza dopuszczalna data urodzenia - granica 13 lat z akcji signup. */
function maxBirthDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 13);
  return d.toISOString().slice(0, 10);
}

type Availability =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "free" }
  | { kind: "taken" }
  | { kind: "invalid"; hint: string };

/**
 * Panel logowania i rejestracji.
 *
 * Obie formy są w jednym komponencie i przełączane zakładką, a nie osobnymi
 * trasami: dzięki temu przełączenie nie przeładowuje strony i nie gubi tego,
 * co użytkownik zdążył wpisać.
 */
export default function AuthPanel() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-6 text-center">
        <p className="text-4xl">🎣</p>
        <h1 className="mt-2 text-2xl font-bold">Wędkarski Portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Miejscówki, połowy i prognoza brań w jednym miejscu.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div
          role="tablist"
          aria-label="Logowanie albo rejestracja"
          className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
        >
          {(["login", "signup"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                mode === value
                  ? "bg-card text-card-foreground shadow-sm"
                  : "text-muted-foreground hover:text-card-foreground"
              }`}
            >
              {value === "login" ? "Logowanie" : "Rejestracja"}
            </button>
          ))}
        </div>

        {mode === "login" ? <LoginForm /> : <SignupForm />}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Zakładając konto akceptujesz{" "}
        <Link href="/regulamin" className="underline hover:text-foreground">
          regulamin
        </Link>{" "}
        i{" "}
        <Link href="/prywatnosc" className="underline hover:text-foreground">
          politykę prywatności
        </Link>
        .
      </p>
    </div>
  );
}

function Alert({ state }: { state: AuthState }) {
  if (!state) return null;

  if (state.error) {
    return (
      <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
        {state.error}
      </p>
    );
  }

  if (state.message) {
    return (
      <p className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
        {state.message}
      </p>
    );
  }

  return null;
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Alert state={state} />

      <Field label="Email" htmlFor="login-email">
        <input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={input}
        />
      </Field>

      <Field label="Hasło" htmlFor="login-password">
        <input
          id="login-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={input}
        />
      </Field>

      <button type="submit" disabled={isPending} className={`${btnPrimary} disabled:opacity-50`}>
        {isPending ? "Loguję..." : "Zaloguj się"}
      </button>
    </form>
  );
}

function SignupForm() {
  const [state, formAction, isPending] = useActionState(signup, null);
  const [username, setUsername] = useState("");
  // Odpowiedź serwera trzymana razem z nazwą, której dotyczy. Bez tej pary nie
  // dałoby się odróżnić "sprawdzone i wolne" od "wynik dla poprzedniej nazwy".
  const [checked, setChecked] = useState<{ name: string; free: boolean } | null>(
    null,
  );

  const candidate = username.trim();
  const isValid = USERNAME_PATTERN.test(candidate);

  // Stan wyliczany podczas renderu, a nie przechowywany: wynika w całości
  // z pola tekstowego i ostatniej odpowiedzi serwera, więc osobny useState
  // mógłby się z nimi rozjechać.
  const availability: Availability = !candidate
    ? { kind: "idle" }
    : !isValid
      ? { kind: "invalid", hint: USERNAME_HINT }
      : checked?.name === candidate
        ? { kind: checked.free ? "free" : "taken" }
        : { kind: "checking" };

  // Odpytanie o zajętość jest opóźnione o 500 ms po ostatnim znaku - bez tego
  // każde naciśnięcie klawisza to osobne zapytanie do bazy.
  useEffect(() => {
    if (!candidate || !isValid) {
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      const result = await checkUsername(candidate);

      // Odpowiedź na porzuconą nazwę nie może nadpisać wyniku dla bieżącej.
      if (cancelled) return;

      setChecked({
        name: candidate,
        free: "error" in result ? false : result.available,
      });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [candidate, isValid]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Alert state={state} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Imię" htmlFor="first-name">
          <input
            id="first-name"
            name="first_name"
            required
            maxLength={60}
            autoComplete="given-name"
            className={input}
          />
        </Field>

        <Field label="Nazwisko" htmlFor="last-name">
          <input
            id="last-name"
            name="last_name"
            required
            maxLength={60}
            autoComplete="family-name"
            className={input}
          />
        </Field>
      </div>

      <Field
        label="Nazwa użytkownika"
        htmlFor="username"
        hint="Pod tą nazwą widzą Cię inni wędkarze. Imię i nazwisko zostają prywatne."
      >
        <div className="flex gap-2">
          <input
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            maxLength={20}
            autoComplete="username"
            className={input}
          />
          <button
            type="button"
            onClick={() => setUsername(randomUsername())}
            title="Wylosuj nazwę"
            aria-label="Wylosuj nazwę użytkownika"
            className="shrink-0 rounded-xl border border-border px-3 transition-colors hover:bg-muted"
          >
            <Dices size={18} />
          </button>
        </div>

        {availability.kind === "checking" && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> Sprawdzam...
          </p>
        )}
        {availability.kind === "free" && (
          <p className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <Check size={12} /> Nazwa jest wolna
          </p>
        )}
        {availability.kind === "taken" && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
            <X size={12} /> Ta nazwa jest już zajęta
          </p>
        )}
        {availability.kind === "invalid" && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            {availability.hint}
          </p>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Data urodzenia" htmlFor="birth-date">
          <input
            id="birth-date"
            name="birth_date"
            type="date"
            required
            max={maxBirthDate()}
            className={input}
          />
        </Field>

        <Field label="Płeć" htmlFor="gender">
          <select id="gender" name="gender" defaultValue="undisclosed" className={input}>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Email" htmlFor="signup-email">
        <input
          id="signup-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={input}
        />
      </Field>

      <Field label="Hasło" htmlFor="signup-password" hint="Co najmniej 8 znaków.">
        <input
          id="signup-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={input}
        />
      </Field>

      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          name="terms"
          required
          className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
        />
        <span>
          Akceptuję{" "}
          <Link href="/regulamin" className="underline hover:text-foreground">
            regulamin
          </Link>{" "}
          oraz{" "}
          <Link href="/prywatnosc" className="underline hover:text-foreground">
            politykę prywatności i cookies
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        disabled={isPending || availability.kind === "taken"}
        className={`${btnPrimary} disabled:opacity-50`}
      >
        {isPending ? "Zakładam konto..." : "Załóż konto"}
      </button>
    </form>
  );
}
