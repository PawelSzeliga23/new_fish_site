"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

const STORAGE_KEY = "cookie-notice-dismissed";

/**
 * localStorage czytany przez useSyncExternalStore, a nie w useEffect.
 *
 * To jest stan zewnętrzny wobec Reacta, więc ten hook jest dla niego właściwym
 * narzędziem: obsługuje różnicę między serwerem a przeglądarką bez rozjazdu
 * hydratacji i bez ustawiania stanu w efekcie.
 */
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    // Prywatne okno albo zablokowane dane stron - traktujemy jak zamknięty.
    return true;
  }
}

/** Na serwerze zakładamy "zamknięty", żeby pasek nie mignął przed hydratacją. */
function serverSnapshot(): boolean {
  return true;
}

/**
 * Komunikat o plikach cookie.
 *
 * Serwis używa wyłącznie plików niezbędnych do działania (sesja logowania,
 * motyw), a na takie zgoda nie jest wymagana - dlatego to jest *informacja*
 * z jednym przyciskiem, a nie okno zgody z wyborem kategorii. Gdyby kiedyś
 * doszła analityka albo reklamy, ten komponent trzeba zastąpić prawdziwym
 * mechanizmem zgody z możliwością odmowy.
 *
 * Decyzja siedzi w localStorage, a nie w cookie: nie musi trafiać na serwer,
 * a tak nie dokładamy kolejnego pliku cookie po to, żeby poinformować o plikach
 * cookie.
 */
export default function CookieNotice() {
  const storedDismissed = useSyncExternalStore(
    subscribe,
    readDismissed,
    serverSnapshot,
  );
  // Zdarzenie "storage" leci tylko do innych kart, więc zamknięcie w tej karcie
  // musi mieć własny stan - inaczej pasek zostałby na ekranie do przeładowania.
  const [dismissedHere, setDismissedHere] = useState(false);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Brak zapisu oznacza tylko tyle, że pasek wróci przy kolejnej wizycie.
    }
    setDismissedHere(true);
  };

  if (storedDismissed || dismissedHere) return null;

  return (
    <div
      role="region"
      aria-label="Informacja o plikach cookie"
      className="fixed inset-x-3 bottom-3 z-[2000] mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xl sm:flex-row sm:items-center"
    >
      <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
        Używamy wyłącznie plików cookie niezbędnych do działania serwisu —
        utrzymania sesji logowania i zapamiętania motywu. Nie śledzimy Cię i nie
        wyświetlamy reklam.{" "}
        <Link href="/prywatnosc" className="underline hover:text-foreground">
          Szczegóły
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Rozumiem
      </button>
    </div>
  );
}
