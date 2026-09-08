"use client";

import { describeWeatherCode, describeWindDirection } from "@/lib/weather";
import type { LocationPoint } from "./MapView";

/** Ta sama skala co karta prognozy brań na stronie miejscówki. */
function toneColor(tone: NonNullable<LocationPoint["bite"]>["tone"]): string {
  if (tone === "bad") return "var(--score-bad)";
  if (tone === "weak") return "var(--score-weak)";
  return "var(--score-good)";
}

/** Wiersz parametru: etykieta po lewej, wartość po prawej - stąd wyrównanie. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default function LocationPopup({ location }: { location: LocationPoint }) {
  const { conditions, bite, hydro } = location;
  const trend =
    conditions === null
      ? ""
      : conditions.pressureDelta3h <= -0.5
        ? ` ↓${Math.abs(conditions.pressureDelta3h).toFixed(1)}`
        : conditions.pressureDelta3h >= 0.5
          ? ` ↑${conditions.pressureDelta3h.toFixed(1)}`
          : " →";

  return (
    <div className="w-full text-card-foreground">
      {location.photos?.[0] && (
        <img
          src={location.photos[0]}
          alt=""
          className="h-24 w-full object-cover"
        />
      )}

      <div className="flex flex-col gap-2 p-3">
        <div>
          <p className="text-sm leading-tight font-bold">
            {location.note || "Miejscówka bez nazwy"}
          </p>
          <p className="text-xs text-muted-foreground">
            {location.waterBodyName ?? "Nieprzypisany akwen"}
            {location.catchCount > 0 && ` · ${location.catchCount} połowów`}
            {location.visibility === "private" && " · 🔒"}
          </p>
        </div>

        {bite && (
          <div
            className="flex items-center justify-between rounded-lg px-2 py-1.5"
            style={{ background: "var(--muted)" }}
          >
            <span className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: toneColor(bite.tone) }}
                aria-hidden
              />
              Brania: {bite.rating.toLowerCase()}
            </span>
            <span className="text-sm font-bold">{bite.score}</span>
          </div>
        )}

        {conditions && (
          <div className="flex flex-col gap-0.5 text-xs">
            <Row
              label="Temperatura"
              value={`${Math.round(conditions.temperature)}°C`}
            />
            <Row
              label="Wiatr"
              value={`${Math.round(conditions.windSpeedKmh)} km/h ${describeWindDirection(conditions.windDirection)}`}
            />
            <Row
              label="Ciśnienie"
              value={`${Math.round(conditions.pressureMsl)} hPa${trend}`}
            />
            <Row label="Niebo" value={describeWeatherCode(conditions.weatherCode)} />
          </div>
        )}

        {hydro && (hydro.waterLevelCm !== null || hydro.waterTemperature !== null) && (
          <div className="flex flex-col gap-0.5 border-t border-border pt-2 text-xs">
            <p className="truncate text-muted-foreground">
              🌊 {hydro.river ? `${hydro.river} - ` : ""}
              {hydro.station} ({hydro.distanceKm} km)
            </p>
            {hydro.waterLevelCm !== null && (
              <Row label="Stan wody" value={`${hydro.waterLevelCm} cm`} />
            )}
            {hydro.waterTemperature !== null && (
              <Row
                label="Temperatura wody"
                value={`${hydro.waterTemperature.toFixed(1)}°C`}
              />
            )}
            {hydro.dischargeM3s !== null && (
              <Row label="Przepływ" value={`${hydro.dischargeM3s} m³/s`} />
            )}
          </div>
        )}

        <a
          href={`/locations/${location.id}`}
          className="mt-1 block rounded-full bg-primary px-3 py-1.5 text-center text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Szczegóły i statystyki
        </a>
      </div>
    </div>
  );
}
