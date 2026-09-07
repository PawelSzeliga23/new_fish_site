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
import { addLocation } from "@/app/map/actions";

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
      className="absolute top-4 right-4 z-[1000] rounded bg-white px-3 py-2 text-sm shadow-lg disabled:opacity-50"
    >
      {locating ? "Namierzam..." : "📍 Moja lokalizacja"}
    </button>
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
    <div style={{ position: "relative", height: "100vh", width: "100%" }}>
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
              </div>
            </Popup>
          </Marker>
        ))}

        {pending && (
          <Marker position={[pending.lat, pending.lng]} icon={markerIcon} />
        )}
      </MapContainer>

      {pending && (
        <div className="absolute bottom-4 left-1/2 z-[1000] w-72 -translate-x-1/2 rounded bg-white p-3 shadow-lg">
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
              className="rounded border p-1 text-sm"
            />
            <input
              type="file"
              name="photo"
              accept="image/*"
              className="text-sm"
            />
            <select name="visibility" className="rounded border p-1 text-sm">
              <option value="private">Tylko ja</option>
              <option value="public">Publiczne</option>
            </select>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded bg-blue-600 py-1 text-sm text-white"
              >
                Zapisz
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded border px-2 py-1 text-sm"
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
