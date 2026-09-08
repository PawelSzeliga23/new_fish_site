"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Picker daty z godziną otwierany jako dymek nad stroną.
 *
 * Natywne `input[type=datetime-local]` wygląda inaczej w każdej przeglądarce i
 * na desktopie nie daje kalendarza razem z godziną, dlatego kalendarz rysujemy
 * sami, a minuty zostawiamy natywnemu `input[type=time]` - tam obsługa jest
 * spójna i od razu daje dokładność co do minuty.
 *
 * Wartość to lokalny znacznik "YYYY-MM-DDTHH:mm" (bez strefy), taki sam format
 * jak w `datetime-local`.
 */

const WEEKDAYS = ["pn", "wt", "śr", "cz", "pt", "so", "nd"];

const MONTHS = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
];

/** Klucz dnia w formacie YYYY-MM-DD, liczony w czasie lokalnym. */
function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function splitValue(value: string): { day: string; time: string } {
  const [day = "", time = ""] = value.split("T");
  return { day, time };
}

export default function DateTimePicker({
  value,
  onChange,
  label,
  placeholder = "Wybierz",
  min,
  max,
  defaultTime = "00:00",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  /** Granice jako "YYYY-MM-DDTHH:mm" - dni poza nimi są wyszarzone. */
  min?: string;
  max?: string;
  /** Godzina wstawiana przy pierwszym kliknięciu w dzień. */
  defaultTime?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { day: selectedDay, time: selectedTime } = splitValue(value);

  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDay ? new Date(`${selectedDay}T12:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // Zamknięcie kliknięciem obok i Escape - bez tego dymek zostaje na ekranie
  // i zasłania listę wyników.
  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const minDay = min ? splitValue(min).day : "";
  const maxDay = max ? splitValue(max).day : "";

  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate();
  // getDay() liczy od niedzieli, a polski kalendarz zaczyna się w poniedziałek.
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

  const pickDay = (day: number) => {
    const key = dayKey(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
    onChange(`${key}T${selectedTime || defaultTime}`);
  };

  const pickTime = (time: string) => {
    if (!time) {
      return;
    }
    onChange(`${selectedDay || dayKey(new Date())}T${time}`);
  };

  const buttonLabel = value
    ? new Date(value).toLocaleString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : placeholder;

  return (
    <div ref={wrapperRef} className={`relative min-w-0 flex-1 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        className="flex w-full items-center gap-1 truncate rounded-xl border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
      >
        <CalendarDays size={14} className="shrink-0 text-muted-foreground" />
        <span className={`truncate ${value ? "" : "text-muted-foreground"}`}>
          {buttonLabel}
        </span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-64 rounded-2xl border border-border bg-card p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
                )
              }
              aria-label="Poprzedni miesiąc"
              className="rounded-full p-1 hover:bg-muted"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="text-sm font-semibold">
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </span>

            <button
              type="button"
              onClick={() =>
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
                )
              }
              aria-label="Następny miesiąc"
              className="rounded-full p-1 hover:bg-muted"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-muted-foreground">
            {WEEKDAYS.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-0.5">
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}

            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const key = dayKey(
                new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day),
              );
              const disabled =
                (minDay !== "" && key < minDay) || (maxDay !== "" && key > maxDay);
              const isSelected = key === selectedDay;

              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDay(day)}
                  className={`rounded-lg py-1 text-xs transition-colors ${
                    isSelected
                      ? "bg-primary font-semibold text-primary-foreground"
                      : disabled
                        ? "text-muted-foreground opacity-40"
                        : "hover:bg-muted"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <label htmlFor={`${label}-time`} className="text-xs text-muted-foreground">
              Godzina
            </label>
            <input
              id={`${label}-time`}
              type="time"
              value={selectedTime}
              onChange={(e) => pickTime(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
            />
          </div>

          <div className="mt-2 flex justify-between">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
            >
              <X size={12} />
              Wyczyść
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Gotowe
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
