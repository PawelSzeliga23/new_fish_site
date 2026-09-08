import {
  describeWeatherCode,
  describeWindDirection,
  type LocationConditions,
} from "@/lib/weather";
import { getMoonPhase } from "@/lib/moon";

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function ConditionsGrid({
  conditions,
}: {
  conditions: LocationConditions;
}) {
  const { current, pressure, forecast } = conditions;
  const today = forecast[0];
  const moon = getMoonPhase(new Date(current.time));

  const trendArrow =
    pressure.direction === "spada" ? "↓" : pressure.direction === "rosnie" ? "↑" : "→";
  const trendSign = pressure.delta3h > 0 ? "+" : "";

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Tile
        label="Temperatura"
        value={`${Math.round(current.temperature)}°C`}
        hint={`odczuwalna ${Math.round(current.apparentTemperature)}°C`}
      />
      <Tile
        label="Ciśnienie"
        value={`${Math.round(current.pressureMsl)} hPa`}
        hint={`${trendArrow} ${trendSign}${pressure.delta3h} hPa/3h · ${trendSign}${pressure.delta24h} hPa/24h`}
      />
      <Tile
        label="Wiatr"
        value={`${Math.round(current.windSpeedKmh)} km/h`}
        hint={`${describeWindDirection(current.windDirection)} · porywy ${Math.round(current.windGustsKmh)} km/h`}
      />
      <Tile
        label="Niebo"
        value={describeWeatherCode(current.weatherCode)}
        hint={`zachmurzenie ${Math.round(current.cloudCover)}%`}
      />
      <Tile
        label="Wilgotność"
        value={`${Math.round(current.humidity)}%`}
        hint={`opad ${current.precipitationMm.toFixed(1)} mm`}
      />
      <Tile
        label="Księżyc"
        value={`${moon.emoji} ${moon.label}`}
        hint={`tarcza w ${Math.round(moon.illumination * 100)}%`}
      />
      {today && (
        <Tile
          label="Słońce"
          value={`${today.sunrise.slice(11, 16)} – ${today.sunset.slice(11, 16)}`}
          hint="wschód i zachód - najlepsze okna doby"
        />
      )}
      {today && (
        <Tile
          label="Dziś"
          value={`${Math.round(today.tempMin)}° / ${Math.round(today.tempMax)}°`}
          hint={`opad ${today.precipitationMm.toFixed(1)} mm · wiatr do ${Math.round(today.windMaxKmh)} km/h`}
        />
      )}
    </div>
  );
}
