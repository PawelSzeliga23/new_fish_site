"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { USERNAME_PATTERN, USERNAME_HINT } from "@/lib/username";

/** Poniżej tego wieku nie zakładamy konta w serwisie społecznościowym. */
const MIN_AGE = 13;

export type AuthState = { error?: string; message?: string } | null;

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Nieprawidłowy email lub hasło." };
  }

  redirect("/");
}

function ageOn(birthDate: string): number {
  const born = new Date(birthDate);
  const now = new Date();
  const years = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());

  return beforeBirthday ? years - 1 : years;
}

/**
 * Rejestracja z pełnymi danymi profilu.
 *
 * Pola profilu jadą w options.data, czyli do raw_user_meta_data - to jedyny
 * kanał, którym signUp() przekazuje cokolwiek poza mailem i hasłem. Przepisuje
 * je stamtąd do profiles trigger handle_new_user (migracja 041), dzięki czemu
 * profil powstaje w jednej transakcji z kontem i nie ma stanu pośredniego
 * "konto jest, profilu brak".
 */
export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();

  const email = ((formData.get("email") as string) ?? "").trim();
  const password = (formData.get("password") as string) ?? "";
  const firstName = ((formData.get("first_name") as string) ?? "").trim();
  const lastName = ((formData.get("last_name") as string) ?? "").trim();
  const username = ((formData.get("username") as string) ?? "").trim();
  const birthDate = ((formData.get("birth_date") as string) ?? "").trim();
  const gender = ((formData.get("gender") as string) ?? "undisclosed").trim();
  const acceptedTerms = formData.get("terms") === "on";

  // Walidacja jest powtórzona po stronie serwera świadomie: atrybuty required
  // i pattern w formularzu to wygoda dla użytkownika, a nie zabezpieczenie -
  // akcję serwerową da się wywołać z pominięciem interfejsu.
  if (!firstName || !lastName) {
    return { error: "Podaj imię i nazwisko." };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return { error: `Nieprawidłowa nazwa użytkownika. ${USERNAME_HINT}.` };
  }

  if (password.length < 8) {
    return { error: "Hasło musi mieć co najmniej 8 znaków." };
  }

  if (!birthDate) {
    return { error: "Podaj datę urodzenia." };
  }

  const age = ageOn(birthDate);

  if (Number.isNaN(age) || age < MIN_AGE) {
    return { error: `Konto może założyć osoba w wieku co najmniej ${MIN_AGE} lat.` };
  }

  if (age > 120) {
    return { error: "Sprawdź datę urodzenia." };
  }

  if (!["male", "female", "other", "undisclosed"].includes(gender)) {
    return { error: "Wybierz płeć z listy." };
  }

  if (!acceptedTerms) {
    return { error: "Musisz zaakceptować regulamin i politykę prywatności." };
  }

  const { data: available, error: checkError } = await supabase.rpc(
    "username_available",
    { candidate: username },
  );

  if (checkError) {
    return { error: checkError.message };
  }

  if (available === false) {
    return { error: "Ta nazwa użytkownika jest już zajęta." };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
      data: {
        username,
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate,
        gender,
        terms_accepted: "true",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return {
    message: `Konto założone. Wysłaliśmy link potwierdzający na ${email} - kliknij go, żeby się zalogować.`,
  };
}

/** Sprawdzenie nazwy na żywo, spod kostki w formularzu rejestracji. */
export async function checkUsername(
  username: string,
): Promise<{ available: boolean } | { error: string }> {
  if (!USERNAME_PATTERN.test(username.trim())) {
    return { error: USERNAME_HINT };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("username_available", {
    candidate: username.trim(),
  });

  if (error) {
    return { error: error.message };
  }

  return { available: data === true };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
