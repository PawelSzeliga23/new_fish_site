"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, GeoJSON } from "react-leaflet";
import type { GeoJsonObject } from "geojson";

// Te same ikony co na dużej mapie - domyślne nie ładują się przez bundler.
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export type LocationMapProps = {
  lat: number;
  lng: number;
  /** Obrys zbiornika z OSM; bez niego mapka pokazuje samą pinezkę. */
  waterBodyGeojson?: GeoJsonObject | null;
  waterBodyName?: string | null;
  className?: string;
};

export default function LocationMap({
  lat,
  lng,
  waterBodyGeojson,
  waterBodyName,
  className = "h-64 w-full rounded-2xl",
}: LocationMapProps) {
  // Z obrysem schodzimy o oczko niżej, żeby cały zbiornik zmieścił się w kadrze.
  const zoom = waterBodyGeojson ? 13 : 15;

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      scrollWheelZoom={false}
      className={className}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {waterBodyGeojson && (
        <GeoJSON
          // Leaflet nie przerysowuje GeoJSON przy zmianie propsa - klucz wymusza
          // remount, gdy miejscówka dostanie inny zbiornik.
          key={waterBodyName ?? "water-body"}
          data={waterBodyGeojson}
          // Kolor idzie przez klasę, a nie przez opcje Leafletu: Leaflet wpisuje
          // je jako atrybuty SVG, a atrybut prezentacyjny nie rozwija var().
          // Wypełnienie tylko dla powierzchni - wypełniona linia rzeki domyka
          // się w wielokąt i zalewa ląd.
          style={
            waterBodyGeojson.type === "Polygon" ||
            waterBodyGeojson.type === "MultiPolygon"
              ? {
                  weight: 2,
                  fillOpacity: 0.2,
                  className: "water-body-outline water-body-area",
                }
              : { weight: 3, className: "water-body-outline" }
          }
        />
      )}

      <Marker position={[lat, lng]} icon={markerIcon} />
    </MapContainer>
  );
}
