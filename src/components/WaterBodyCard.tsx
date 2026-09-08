import { detectWaterBody } from "@/app/map/actions";
import { describeWaterBodyType, formatArea } from "@/lib/format";
import { btnSecondary, meta, subheading } from "@/lib/ui";

export type WaterBody = {
  id: string;
  name: string;
  type: string;
  area_ha: number | null;
  species: string[] | null;
  source: string;
  /** Obrys z PostGIS jako GeoJSON - rysuje go mapka miejscówki. */
  geojson: GeoJSON.GeoJsonObject | null;
};

export default function WaterBodyCard({
  waterBody,
  locationId,
  lat,
  lng,
  isOwner,
}: {
  waterBody: WaterBody | null;
  locationId: string;
  lat: number;
  lng: number;
  isOwner: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <h2 className={subheading}>Zbiornik</h2>

      {waterBody ? (
        <>
          <div>
            <p className="text-lg font-bold">{waterBody.name}</p>
            <p className={meta}>
              {describeWaterBodyType(waterBody.type)} · {formatArea(waterBody.area_ha)}
            </p>
          </div>

          {waterBody.species && waterBody.species.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {waterBody.species.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-border px-2 py-0.5 text-xs"
                >
                  {name}
                </span>
              ))}
            </div>
          )}

          {waterBody.source === "osm" && (
            <p className="text-xs text-muted-foreground">
              Obrys z OpenStreetMap (licencja ODbL)
            </p>
          )}
        </>
      ) : (
        <p className={meta}>
          Nie wiemy jeszcze, na jakiej wodzie leży ta miejscówka. Pobranie obrysu
          z OpenStreetMap podepnie ją do zbiornika i pokaże jego powierzchnię.
        </p>
      )}

      {isOwner && (
        <form action={detectWaterBody}>
          <input type="hidden" name="location_id" value={locationId} />
          <input type="hidden" name="lat" value={lat} />
          <input type="hidden" name="lng" value={lng} />
          <button type="submit" className={btnSecondary}>
            {waterBody ? "Odśwież obrys z OSM" : "Wykryj zbiornik"}
          </button>
        </form>
      )}
    </div>
  );
}
