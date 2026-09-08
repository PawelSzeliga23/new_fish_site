"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { GeoJsonObject } from "geojson";
import { createClient } from "@/lib/supabase/client";
import { addLocation, importWaterBodiesAt } from "@/app/map/actions";
import LocationPopup from "./LocationPopup";
import { input, btnPrimary, btnSecondary } from "@/lib/ui";
import FileInput from "./FileInput";

/** Poniżej tego przybliżenia w kadrze mieści się pół kraju - obrysy nie mają sensu. */
const MIN_WATER_ZOOM = 10;

/**
 * Minimalna powierzchnia obrysu (ha) pokazywana przy danym przybliżeniu.
 *
 * Przy oddalonym widoku staw o powierzchni 0,6 ha to i tak kilka pikseli, a
 * takich drobiazgów są w kadrze tysiące - to one wysadzały zapytanie w limit
 * czasu. Cieki liniowe nie mają powierzchni i pokazujemy je zawsze.
 */
function minAreaForZoom(zoom: number): number {
  if (zoom >= 14) return 0;
  if (zoom >= 13) return 0.5;
  if (zoom >= 12) return 2;
  if (zoom >= 11) return 8;
  return 25;
}

// domyślne ikony Leaflet nie ładują się poprawnie z bundlerem (Turbopack/Webpack) -
// trzeba je ręcznie wskazać na CDN
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export type LocationPoint = {
  id: string;
  note: string | null;
  visibility: string;
  lat: number;
  lng: number;
  photos: string[] | null;
  waterBodyName: string | null;
  catchCount: number;
  conditions: {
    temperature: number;
    windSpeedKmh: number;
    windDirection: number;
    pressureMsl: number;
    pressureDelta3h: number;
    cloudCover: number;
    weatherCode: number;
  } | null;
  bite: { score: number; rating: string; tone: "bad" | "weak" | "good" | "great" } | null;
  hydro: {
    station: string;
    river: string;
    waterLevelCm: number | null;
    waterTemperature: number | null;
    dischargeM3s: number | null;
    distanceKm: number;
  } | null;
};

export type WaterBodyShape = {
  id: string;
  name: string;
  type: string;
  area_ha: number | null;
  geojson: GeoJsonObject;
};

/**
 * Styl obrysu zależny od rodzaju geometrii.
 *
 * Powierzchnie (jeziora, stawy, szerokie rzeki) dostają wypełnienie, cieki
 * liniowe wyłącznie kreskę - wypełniona linia rzeki domyka się w wielokąt i
 * zalewa okoliczny ląd.
 */
function waterBodyStyle(geojson: GeoJsonObject) {
  const isArea = geojson.type === "Polygon" || geojson.type === "MultiPolygon";

  return isArea
    ? { weight: 2, fillOpacity: 0.2, className: "water-body-outline water-body-area" }
    : { weight: 3, className: "water-body-outline" };
}

/** Stan warstwy zbiorników - pokazywany na mapie, żeby pusta mapa nie milczała. */
type WaterStatus =
  | { kind: "zoomOut" }
  | { kind: "loading" }
  | { kind: "ready"; count: number }
  | { kind: "error"; message: string };

/** Stan sprawdzenia, czy wybrany punkt leży wystarczająco blisko wody. */
type NearWater =
  | null
  | { status: "loading" }
  | { status: "found"; name: string; distanceM: number }
  | { status: "none" };

/**
 * Doczytuje obrysy zbiorników dla aktualnego kadru.
 *
 * W bazie leży kilkadziesiąt tysięcy obiektów z importu Geofabrika, więc nie da
 * się ich wysłać do przeglądarki naraz. Po każdym przesunięciu mapy pytamy o to,
 * co widać; przy widoku całego kraju odpuszczamy, bo i tak nie dałoby się tego
 * sensownie narysować.
 */
function WaterBodyLoader({
  onLoad,
  onStatus,
}: {
  onLoad: (bodies: WaterBodyShape[]) => void;
  onStatus: (status: WaterStatus) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      if (map.getZoom() < MIN_WATER_ZOOM) {
        onLoad([]);
        onStatus({ kind: "zoomOut" });
        return;
      }

      onStatus({ kind: "loading" });

      const bounds = map.getBounds();
      const { data, error } = await supabase.rpc("water_bodies_in_bbox", {
        min_lat: bounds.getSouth(),
        min_lng: bounds.getWest(),
        max_lat: bounds.getNorth(),
        max_lng: bounds.getEast(),
        min_area_ha: minAreaForZoom(map.getZoom()),
      });

      if (cancelled) {
        return;
      }

      // Wcześniej błąd RPC był połykany i mapa po prostu zostawała pusta bez
      // żadnego śladu - najgorszy możliwy tryb awarii przy diagnozowaniu.
      if (error) {
        console.error("[mapa] nie udało się pobrać zbiorników:", error.message);
        onLoad([]);
        onStatus({ kind: "error", message: error.message });
        return;
      }

      const bodies = (data as WaterBodyShape[]) ?? [];
      onLoad(bodies);
      onStatus({ kind: "ready", count: bodies.length });
    };

    // Przeciąganie mapy sypie zdarzeniami seriami - bez opóźnienia poszłoby
    // kilkanaście zapytań na jeden gest.
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 300);
    };

    load();
    map.on("moveend", schedule);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      map.off("moveend", schedule);
    };
  }, [map, onLoad, onStatus]);

  return null;
}

/**
 * Pobiera obrysy zbiorników dla tego, co widać na ekranie. Overpass odrzuca
 * zapytania o geometrię z dużego obszaru, więc promień liczymy z aktualnych
 * granic mapy i przy zbyt szerokim widoku prosimy o przybliżenie.
 */
function ImportWaterBodiesButton() {
  const map = useMap();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = async () => {
    const center = map.getCenter();
    const radius = center.distanceTo(map.getBounds().getNorthEast());

    if (radius > 6000) {
      setMessage("Przybliż mapę - obrysy pobieram dla widoku do ok. 5 km.");
      return;
    }

    setPending(true);
    setMessage(null);

    const formData = new FormData();
    formData.set("lat", String(center.lat));
    formData.set("lng", String(center.lng));
    formData.set("radius", String(Math.round(radius)));

    const result = await importWaterBodiesAt(formData);

    setMessage(
      !result.ok
        ? result.message
        : result.saved > 0
          ? `Zapisano ${result.saved} zbiorników z OpenStreetMap.`
          : "W tym miejscu nie ma zmapowanej wody.",
    );
    setPending(false);
  };

  return (
    <div className="absolute top-16 right-4 z-[1000] flex max-w-64 flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-card-foreground shadow-lg disabled:opacity-50"
      >
        {pending ? "Pobieram obrysy..." : "🌊 Wykryj zbiorniki tutaj"}
      </button>
      {message && (
        <p className="rounded-lg border border-border bg-card px-2 py-1 text-right text-xs text-card-foreground shadow-lg">
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * Ustawia kadr na miejscówki użytkownika przy pierwszym wejściu.
 *
 * Startowy widok całej Polski (zoom 6) był poniżej progu, od którego rysujemy
 * obrysy zbiorników - mapa otwierała się pusta i wyglądała na zepsutą, choć
 * działała zgodnie z założeniem.
 */
function FitToLocations({ locations }: { locations: LocationPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) {
      return;
    }

    map.fitBounds(
      L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng] as [number, number])),
      // maxZoom, bo przy jednej miejscówce fitBounds przybliżyłby do maksimum.
      // animate: false, żeby zoom był ustawiony od razu - WaterBodyLoader pyta
      // o kadr zaraz po zamontowaniu i przy animacji zobaczyłby jeszcze zoom 6.
      { maxZoom: 13, padding: [40, 40], animate: false },
    );
  }, [map, locations]);

  return null;
}

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function LocateButton({
  onLocate,
}: {
  onLocate: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  const handleClick = () => {
    if (!navigator.geolocation) {
      alert("Twoja przeglądarka nie wspiera geolokalizacji");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.flyTo([latitude, longitude], 14);
        onLocate(latitude, longitude);
        setLocating(false);
      },
      (err) => {
        alert(`Nie udało się pobrać lokalizacji: ${err.message}`);
        setLocating(false);
      },
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={locating}
      className="absolute top-4 right-4 z-[1000] rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-card-foreground shadow-lg disabled:opacity-50"
    >
      {locating ? "Namierzam..." : "📍 Moja lokalizacja"}
    </button>
  );
}

export default function MapView({ locations }: { locations: LocationPoint[] }) {
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [waterBodies, setWaterBodies] = useState<WaterBodyShape[]>([]);
  const [waterStatus, setWaterStatus] = useState<WaterStatus>({ kind: "zoomOut" });
  const [nearWater, setNearWater] = useState<NearWater>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Regułę "najwyżej 50 m od wody" wymusza add_location, ale użytkownik powinien
  // wiedzieć o niej przed wypełnieniem formularza, a nie dostać błąd po zapisie.
  useEffect(() => {
    // Stany "brak punktu" i "sprawdzam" ustawiają pickPoint/clearPending -
    // efekt tylko dopisuje wynik zapytania, żeby nie wywoływać setState
    // synchronicznie przy każdym przebiegu.
    if (!pending) {
      return;
    }

    let cancelled = false;

    createClient()
      .rpc("water_body_near", { lat: pending.lat, lng: pending.lng })
      .then(({ data }) => {
        if (cancelled) {
          return;
        }
        const hit = (data as { name: string; distance_m: number }[] | null)?.[0];
        setNearWater(
          hit
            ? { status: "found", name: hit.name, distanceM: hit.distance_m }
            : { status: "none" },
        );
      });

    return () => {
      cancelled = true;
    };
  }, [pending]);

  // useCallback, bo ta funkcja jest zależnością efektu w WaterBodyLoader -
  // nowa referencja przy każdym renderze kasowałaby i zakładała nasłuch na
  // mapie w kółko.
  // Stan "sprawdzam" ustawiamy przy wyborze punktu, a nie w efekcie - setState
  // wywołany synchronicznie w efekcie wymusza dodatkowy przebieg renderowania.
  const pickPoint = useCallback((lat: number, lng: number) => {
    setPending({ lat, lng });
    setNearWater({ status: "loading" });
    setSaveError(null);
  }, []);

  const clearPending = useCallback(() => {
    setPending(null);
    setNearWater(null);
    setSaveError(null);
  }, []);

  const handleWaterBodies = useCallback((bodies: WaterBodyShape[]) => {
    setWaterBodies(bodies);
  }, []);

  const handleWaterStatus = useCallback((status: WaterStatus) => {
    setWaterStatus(status);
  }, []);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[52.0, 19.0]}
        zoom={6}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Bez tego pusta mapa niczym się nie różni od zepsutej - a przy zoomie
            poniżej progu obrysów po prostu nie pobieramy. */}
        <div className="absolute bottom-4 left-4 z-[1000] max-w-72 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-card-foreground shadow-lg">
          {waterStatus.kind === "zoomOut" &&
            "🔍 Przybliż mapę, żeby zobaczyć zbiorniki wodne"}
          {waterStatus.kind === "loading" && "🌊 Wczytuję zbiorniki..."}
          {waterStatus.kind === "ready" &&
            (waterStatus.count > 0
              ? `🌊 ${waterStatus.count} zbiorników w kadrze`
              : "🌊 Brak zmapowanej wody w tym kadrze")}
          {waterStatus.kind === "error" && `⚠ ${waterStatus.message}`}
        </div>

        <FitToLocations locations={locations} />
        <ClickHandler onPick={pickPoint} />
        <LocateButton onLocate={pickPoint} />
        <ImportWaterBodiesButton />
        <WaterBodyLoader onLoad={handleWaterBodies} onStatus={handleWaterStatus} />

        {/* Obrysy rysujemy pod pinezkami, żeby nie przykrywały markerów. */}
        {waterBodies.map((body) => (
          <GeoJSON
            key={body.id}
            data={body.geojson}
            style={waterBodyStyle(body.geojson)}
          >
            <Popup>
              <span className="water-body-popup block">
                <span className="font-semibold">{body.name}</span>
                {body.area_ha !== null && (
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    · {Math.round(body.area_ha)} ha
                  </span>
                )}
              </span>
            </Popup>
          </GeoJSON>
        ))}

        {locations.map((loc) => (
          <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={markerIcon}>
            {/* maxWidth/minWidth, bo Leaflet dobiera szerokość dymka do treści -
                bez tego każdy wyglądałby inaczej i nic by się nie wyrównywało.
                Rejestrowania połowu tu nie ma: formularz z polami na gatunek,
                wagę i zdjęcie nie mieści się w dymku, a jest na stronie
                szczegółów. */}
            <Popup maxWidth={260} minWidth={260}>
              <LocationPopup location={loc} />
            </Popup>
          </Marker>
        ))}

        {pending && (
          <Marker position={[pending.lat, pending.lng]} icon={markerIcon} />
        )}
      </MapContainer>

      {pending && (
        <div className="absolute bottom-4 left-1/2 z-[1000] w-72 -translate-x-1/2 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-lg">
          <form
            action={async (formData) => {
              formData.set("lat", String(pending.lat));
              formData.set("lng", String(pending.lng));
              try {
                await addLocation(formData);
                clearPending();
              } catch (err) {
                // Walidacja odległości od wody żyje w bazie, więc jej komunikat
                // wraca tutaj - pokazujemy go w formularzu zamiast wywalać stronę.
                setSaveError(
                  err instanceof Error ? err.message : "Nie udało się zapisać miejscówki.",
                );
              }
            }}
            className="flex flex-col gap-2"
          >
            <p className="text-sm font-medium">Nowa miejscówka</p>

            {nearWater?.status === "loading" && (
              <p className="text-xs text-muted-foreground">Sprawdzam, czy to nad wodą...</p>
            )}
            {nearWater?.status === "found" && (
              <p className="text-xs text-muted-foreground">
                🌊 {nearWater.name} · {Math.round(nearWater.distanceM)} m stąd
              </p>
            )}
            {nearWater?.status === "none" && (
              <p className="text-xs font-semibold" style={{ color: "var(--score-bad)" }}>
                Za daleko od wody. Miejscówkę można postawić najwyżej 50 m od
                brzegu zbiornika lub rzeki.
              </p>
            )}
            {/* Kolumna w bazie nazywa się `note` z pierwszej wersji schematu,
                ale od dawna pełni rolę nazwy - to ona jest tytułem miejscówki
                na liście i na jej stronie. Formularz nazywa rzecz po imieniu.
                Podpowiedź bierzemy z wykrytego akwenu, ale nie wstawiamy jej z
                automatu: inaczej połowa miejscówek nazywałaby się "Wisła". */}
            <input
              name="note"
              required
              maxLength={80}
              placeholder={
                nearWater?.status === "found"
                  ? `np. ${nearWater.name} - przy pomoście`
                  : "Nazwa miejscówki"
              }
              className={input}
            />
            <FileInput name="photo" label="Zdjęcie" />
            <select
              name="visibility"
              className={input}
            >
              <option value="private">Tylko ja</option>
              <option value="friends">Znajomi</option>
              <option value="public">Publiczne</option>
            </select>
            {saveError && (
              <p className="text-xs font-semibold" style={{ color: "var(--score-bad)" }}>
                {saveError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={nearWater?.status !== "found"}
                className={`${btnPrimary} flex-1 disabled:opacity-40`}
              >
                Zapisz
              </button>
              <button
                type="button"
                onClick={clearPending}
                className={btnSecondary}
              >
                Anuluj
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
