"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { addLocation, logCatch } from "@/app/map/actions";
import type { WeatherSnapshot } from "@/lib/weather";
import { input, btnPrimary, btnSecondary, btnLink } from "@/lib/ui";
import FileInput from "./FileInput";

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
  weather: WeatherSnapshot | null;
};

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

function CatchForm({
  locationId,
  lat,
  lng,
}: {
  locationId: string;
  lat: number;
  lng: number;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${btnLink} mt-1`}
      >
        Zarejestruj połów
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await logCatch(formData);
        setOpen(false);
      }}
      className="mt-1 flex flex-col gap-1"
    >
      <input type="hidden" name="location_id" value={locationId} />
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />
      <input
        name="species"
        placeholder="Gatunek"
        required
        className={input}
      />
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
      <FileInput name="photo" label="Zdjęcie" />
      <button
        type="submit"
        className={btnPrimary}
      >
        Zapisz połów
      </button>
    </form>
  );
}

export default function MapView({
  locations,
}: {
  locations: LocationPoint[];
}) {
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(
    null,
  );

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

        <ClickHandler onPick={(lat, lng) => setPending({ lat, lng })} />
        <LocateButton onLocate={(lat, lng) => setPending({ lat, lng })} />

        {locations.map((loc) => (
          <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={markerIcon}>
            <Popup>
              <div className="flex flex-col gap-1">
                <span>{loc.note || "(bez notatki)"}</span>
                {loc.photos?.[0] && (
                  <img
                    src={loc.photos[0]}
                    alt="Zdjęcie miejscówki"
                    className="w-full rounded"
                  />
                )}
                {loc.weather && (
                  <span className="text-xs text-muted-foreground">
                    🌡 {loc.weather.temperature}°C · 💨{" "}
                    {loc.weather.windSpeedKmh} km/h · 🔽{" "}
                    {loc.weather.pressureMsl} hPa
                  </span>
                )}
                <CatchForm locationId={loc.id} lat={loc.lat} lng={loc.lng} />
                <a
                  href={`/locations/${loc.id}`}
                  className={btnLink}
                >
                  Szczegóły i statystyki
                </a>
              </div>
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
              await addLocation(formData);
              setPending(null);
            }}
            className="flex flex-col gap-2"
          >
            <p className="text-sm font-medium">Nowa miejscówka</p>
            <textarea
              name="note"
              placeholder="Notatka (opcjonalnie)"
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
            <div className="flex gap-2">
              <button
                type="submit"
                className={`${btnPrimary} flex-1`}
              >
                Zapisz
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
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
