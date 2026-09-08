import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocationConditions } from "@/lib/weather";
import { getHydrology } from "@/lib/hydro";
import { computeBiteScore, computeBiteOutlook } from "@/lib/bite-score";
import { logCatch } from "@/app/map/actions";
import { TemperatureChart, PrecipitationChart } from "@/components/ForecastChart";
import BiteScoreCard from "@/components/BiteScoreCard";
import BiteOutlookChart from "@/components/BiteOutlookChart";
import ConditionsGrid from "@/components/ConditionsGrid";
import HydroCard from "@/components/HydroCard";
import WaterBodyCard, { type WaterBody } from "@/components/WaterBodyCard";
import CatchRanking from "@/components/CatchRanking";
import type { CatchReport } from "@/lib/catches";
import LocationMapLoader from "@/components/LocationMapLoader";
import PhotoLightbox from "@/components/PhotoLightbox";
import FileInput from "@/components/FileInput";
import {
  card,
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
  owner_username: string;
  owner_avatar_url: string | null;
  note: string | null;
  visibility: string;
  access_info: string | null;
  lat: number;
  lng: number;
  photos: string[] | null;
  water_body_id: string | null;
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

  // Cztery niezależne źródła - pogoda, hydrologia, połowy i zbiornik - lecą
  // równolegle, żeby strona nie czekała na sumę ich opóźnień.
  const [conditions, hydrology, { data: catches }, { data: waterBodyRows }] =
    await Promise.all([
      getLocationConditions(loc.lat, loc.lng),
      getHydrology(loc.lat, loc.lng),
      supabase.rpc("list_catches_for_location", { target_location_id: id }),
      loc.water_body_id
        ? supabase.rpc("get_water_body", { target_id: loc.water_body_id })
        : Promise.resolve({ data: null }),
    ]);

  const catchList = (catches as CatchReport[]) ?? [];
  const waterBody = ((waterBodyRows as WaterBody[]) ?? [])[0] ?? null;

  // Temperatura wody z posterunku IMGW wchodzi wprost do heurystyki - rządzi
  // metabolizmem ryb mocniej niż temperatura powietrza.
  const waterTemperature = hydrology.station?.waterTemperature ?? null;

  const bite =
    conditions && conditions.forecast.length > 0
      ? computeBiteScore({
          at: new Date(conditions.current.time),
          pressureMsl: conditions.current.pressureMsl,
          pressureDelta3h: conditions.pressure.delta3h,
          airTemperature: conditions.current.temperature,
          waterTemperature,
          windSpeedKmh: conditions.current.windSpeedKmh,
          cloudCover: conditions.current.cloudCover,
          sunrise: new Date(conditions.forecast[0].sunrise),
          sunset: new Date(conditions.forecast[0].sunset),
        })
      : null;

  const outlook = conditions ? computeBiteOutlook(conditions, waterTemperature) : null;

  const title = loc.note || `Miejscówka ${loc.id.slice(0, 8)}`;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Mapa gra rolę zdjęcia w tle - tak jak okładka na profilu. `isolate`
          zamyka wysokie z-indeksy paneli Leafletu (400+) we własnym kontekście
          układania, inaczej kafelki nachodziłyby na avatar wsunięty pod spód. */}
      <div className="isolate h-52 w-full bg-muted">
        <LocationMapLoader
          lat={loc.lat}
          lng={loc.lng}
          waterBodyGeojson={waterBody?.geojson ?? null}
          waterBodyName={waterBody?.name ?? null}
          className="h-full w-full"
        />
      </div>

      <div className="px-4 pb-8">
        <div className="relative z-10 -mt-14 mb-4 flex items-end gap-4">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-background bg-muted">
            {loc.photos?.[0] ? (
              <PhotoLightbox
                src={loc.photos[0]}
                alt="Zdjęcie miejscówki"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-3xl">
                🎣
              </span>
            )}
          </div>

          {isOwner && (
            <a href={`/locations/${loc.id}/edit`} className={`${btnSecondary} ml-auto`}>
              Edytuj miejscówkę
            </a>
          )}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className={meta}>
              {waterBody && <>{waterBody.name} · </>}
              Założył{" "}
              <a
                href={`/u/${encodeURIComponent(loc.owner_username)}`}
                className="font-semibold hover:underline"
              >
                {isOwner ? "Ty" : loc.owner_username}
              </a>
            </p>
          </div>

          {/* ml-auto dosuwa akcje do prawej krawędzi, a przy wąskim ekranie
              flex-wrap i tak przenosi je do nowego wiersza. */}
          <div className="ml-auto flex flex-wrap gap-2">
            <a href="#dodaj-polow" className={btnPrimary}>
              Dodaj połów
            </a>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={btnSecondary}
            >
              Nawiguj
            </a>
            <a href={`/api/locations/${loc.id}/gpx`} className={btnSecondary}>
              Pobierz mapę (GPX)
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          {/* Kolumna główna - informacje o miejscówce, tam gdzie na profilu są posty. */}
          <div className="flex flex-col gap-5">
            {bite ? (
              <>
                <BiteScoreCard bite={bite} />

                {outlook && outlook.hours.length > 0 && (
                  <div className={`${card} flex flex-col gap-3`}>
                    <h2 className={subheading}>Kiedy jechać (48 h)</h2>
                    <BiteOutlookChart outlook={outlook} />
                  </div>
                )}
              </>
            ) : (
              <p className={meta}>
                Prognoza brań wymaga danych pogodowych, których teraz nie ma.
              </p>
            )}

            <WaterBodyCard
              waterBody={waterBody}
              locationId={loc.id}
              lat={loc.lat}
              lng={loc.lng}
              isOwner={isOwner}
            />

            {conditions && (
              <div className="flex flex-col gap-3">
                <h2 className={heading}>Warunki teraz</h2>
                <ConditionsGrid conditions={conditions} />
              </div>
            )}

            {!conditions && (
              <p className={meta}>
                Nie udało się pobrać danych pogodowych - Open-Meteo nie
                odpowiedziało. Odśwież stronę za chwilę.
              </p>
            )}

            <div className="flex flex-col gap-3">
              <h2 className={heading}>Hydrologia</h2>
              <HydroCard hydrology={hydrology} />
            </div>

            {conditions && (
              <>
                <div className={`${card} flex flex-col gap-3`}>
                  <h2 className={subheading}>Prognoza temperatury (7 dni)</h2>
                  <TemperatureChart forecast={conditions.forecast} />
                </div>

                <div className={`${card} flex flex-col gap-3`}>
                  <h2 className={subheading}>Prognoza opadów (mm)</h2>
                  <PrecipitationChart forecast={conditions.forecast} />
                </div>
              </>
            )}

            <div className={`${card} flex flex-col gap-3`}>
              <h2 className={subheading}>Jak dotrzeć</h2>
              {loc.access_info ? (
                <p className="text-sm">{loc.access_info}</p>
              ) : (
                <p className={meta}>
                  Brak opisu dojazdu.
                  {isOwner && " Dodasz go w edycji miejscówki."}
                </p>
              )}
            </div>

          </div>

          {/* Kolumna boczna - historia połowów, tam gdzie na profilu są znajomi,
              a pod nią formularz, żeby dopisanie połowu stało obok listy, do
              której trafia. */}
          <aside className="flex flex-col gap-5">
            <CatchRanking
              catches={catchList}
              currentUserId={user!.id}
              locationId={loc.id}
            />

            <div id="dodaj-polow" className={`${card} flex scroll-mt-4 flex-col gap-3`}>
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
          </aside>
        </div>
      </div>
    </div>
  );
}
