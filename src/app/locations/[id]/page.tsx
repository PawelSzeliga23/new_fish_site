import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWeather, getWeatherForecast } from "@/lib/weather";
import { updateLocationAccessInfo, logCatch } from "@/app/map/actions";
import { TemperatureChart, PrecipitationChart } from "@/components/ForecastChart";
import FileInput from "@/components/FileInput";
import {
  page,
  card,
  cardCompact,
  heading,
  subheading,
  meta,
  input,
  btnPrimary,
  btnSecondary,
} from "@/lib/ui";

type Location = {
  id: string;
  user_id: string;
  note: string | null;
  visibility: string;
  access_info: string | null;
  lat: number;
  lng: number;
  photos: string[] | null;
};

type CatchReport = {
  id: string;
  species: string;
  weight_kg: number | null;
  length_cm: number | null;
  caught_at: string;
  photos: string[] | null;
};

export default async function LocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: locationRows, error } = await supabase.rpc("get_location", {
    target_id: id,
  });

  if (error) {
    throw new Error(error.message);
  }

  const loc = (locationRows as Location[])?.[0];
  if (!loc) {
    notFound();
  }

  const isOwner = loc.user_id === user!.id;

  const [weather, forecast, { data: catches }] = await Promise.all([
    getCurrentWeather(loc.lat, loc.lng),
    getWeatherForecast(loc.lat, loc.lng),
    supabase.rpc("list_catches_for_location", { target_location_id: id }),
  ]);

  const catchList = (catches as CatchReport[]) ?? [];
  const totalCatches = catchList.length;
  const totalWeight = catchList.reduce((sum, c) => sum + (c.weight_kg ?? 0), 0);
  const distinctDays = new Set(catchList.map((c) => c.caught_at.slice(0, 10))).size;

  const speciesCounts = new Map<string, number>();
  for (const c of catchList) {
    speciesCounts.set(c.species, (speciesCounts.get(c.species) ?? 0) + 1);
  }
  const speciesBreakdown = [...speciesCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxSpeciesCount = Math.max(1, ...speciesBreakdown.map(([, count]) => count));

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;

  return (
    <div className={`${page} flex flex-col gap-5`}>
      <div>
        <h1 className="text-2xl font-bold">
          {loc.note || `Miejscówka ${loc.id.slice(0, 8)}`}
        </h1>
        {weather && (
          <p className={`${meta} mt-1`}>
            Teraz: 🌡 {weather.temperature}°C · 💨 {weather.windSpeedKmh} km/h · 🔽{" "}
            {weather.pressureMsl} hPa
          </p>
        )}
      </div>

      {loc.photos?.[0] && (
        <img
          src={loc.photos[0]}
          alt="Zdjęcie miejscówki"
          className="w-full rounded-2xl"
        />
      )}

      <div className="flex flex-wrap gap-2">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={btnPrimary}
        >
          Nawiguj (Google Maps)
        </a>
        <a href={`/api/locations/${loc.id}/gpx`} className={btnSecondary}>
          Eksportuj GPX (Garmin)
        </a>
      </div>

      <div className={`${card} flex flex-col gap-3`}>
        <h2 className={subheading}>Jak dotrzeć</h2>
        {loc.access_info && <p className="text-sm">{loc.access_info}</p>}
        {!loc.access_info && !isOwner && (
          <p className={meta}>Brak opisu dojazdu.</p>
        )}
        {isOwner && (
          <form action={updateLocationAccessInfo} className="flex flex-col gap-3">
            <input type="hidden" name="location_id" value={loc.id} />
            <textarea
              name="access_info"
              rows={3}
              defaultValue={loc.access_info ?? ""}
              placeholder="np. Zjazd polną drogą od strony wsi X, parking przy moście..."
              className={input}
            />
            <button type="submit" className={`${btnPrimary} self-start`}>
              Zapisz
            </button>
          </form>
        )}
      </div>

      <div className={`${card} flex flex-col gap-3`}>
        <h2 className={subheading}>Prognoza temperatury (7 dni)</h2>
        <TemperatureChart forecast={forecast} />
      </div>

      <div className={`${card} flex flex-col gap-3`}>
        <h2 className={subheading}>Prognoza opadów (mm)</h2>
        <PrecipitationChart forecast={forecast} />
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className={card}>
          <p className="text-2xl font-bold">{totalCatches}</p>
          <p className="text-xs text-muted-foreground">Złowionych ryb</p>
        </div>
        <div className={card}>
          <p className="text-2xl font-bold">{totalWeight.toFixed(1)} kg</p>
          <p className="text-xs text-muted-foreground">Łączna waga</p>
        </div>
        <div className={card}>
          <p className="text-2xl font-bold">{distinctDays}</p>
          <p className="text-xs text-muted-foreground">Dni z połowem</p>
        </div>
      </div>

      {speciesBreakdown.length > 0 && (
        <div className={`${card} flex flex-col gap-3`}>
          <h2 className={subheading}>Gatunki</h2>
          <div className="flex flex-col gap-1">
            {speciesBreakdown.map(([species, count]) => (
              <div key={species} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-sm">{species}</span>
                <div className="h-3 flex-1 rounded bg-muted">
                  <div
                    className="h-3 rounded bg-primary"
                    style={{ width: `${(count / maxSpeciesCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-sm">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`${card} flex flex-col gap-3`}>
        <h2 className={subheading}>Zarejestruj połów</h2>
        <form action={logCatch} className="flex flex-col gap-3">
          <input type="hidden" name="location_id" value={loc.id} />
          <input type="hidden" name="lat" value={loc.lat} />
          <input type="hidden" name="lng" value={loc.lng} />
          <input name="species" placeholder="Gatunek" required className={input} />
          <div className="flex gap-3">
            <input
              name="weight_kg"
              type="number"
              step="0.01"
              placeholder="Waga (kg)"
              className={input}
            />
            <input
              name="length_cm"
              type="number"
              step="0.1"
              placeholder="Długość (cm)"
              className={input}
            />
          </div>
          <FileInput name="photo" label="Zdjęcie połowu" />
          <button type="submit" className={`${btnPrimary} self-start`}>
            Zapisz połów
          </button>
        </form>
      </div>

      {catchList.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className={heading}>Historia połowów</h2>
          {catchList.map((c) => (
            <div key={c.id} className={`${cardCompact} text-sm`}>
              <p>
                {c.species} {c.weight_kg && `· ${c.weight_kg} kg`}{" "}
                {c.length_cm && `· ${c.length_cm} cm`}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(c.caught_at).toLocaleDateString("pl-PL")}
              </p>
              {c.photos?.[0] && (
                <img
                  src={c.photos[0]}
                  alt="Zdjęcie połowu"
                  className="mt-1 w-full rounded"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
