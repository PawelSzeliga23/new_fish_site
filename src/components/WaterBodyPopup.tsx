"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { renameWaterBody } from "@/app/map/actions";
import { input } from "@/lib/ui";
import type { WaterBodyShape } from "./MapView";

/** Etykiety po polsku - w bazie typ jest angielski, bo tak mapuje go import. */
const TYPE_LABEL: Record<string, string> = {
  lake: "jezioro",
  river: "rzeka",
  pond: "staw",
  reservoir: "zbiornik zaporowy",
};

/**
 * Dymek obrysu zbiornika. Dla admina dokłada dwie operacje na warstwie wód:
 * zmianę nazwy i usunięcie.
 *
 * Obie są tu, a nie w osobnym panelu, bo korekta ma sens dopiero wtedy, gdy
 * widać obrys na mapie - to kształt zdradza, że "Narew" jest w rzeczywistości
 * rozlewiskiem, a nie rzeką.
 */
export default function WaterBodyPopup({
  body,
  isAdmin,
  onRenamed,
  onRequestDelete,
}: {
  body: WaterBodyShape;
  isAdmin: boolean;
  onRenamed: (id: string, name: string) => void;
  onRequestDelete: (body: WaterBodyShape) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(body.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("water_body_id", body.id);
    formData.set("name", name);

    const result = await renameWaterBody(formData);

    if (result.ok && result.name) {
      onRenamed(body.id, result.name);
      setEditing(false);
    } else {
      setError(result.message);
    }

    setPending(false);
  };

  const cancelEdit = () => {
    setName(body.name);
    setError(null);
    setEditing(false);
  };

  return (
    <div className="water-body-popup">
      {editing ? (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoFocus
            aria-label="Nazwa zbiornika"
            className={input}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={pending || !name.trim()}
              className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              {pending ? "Zapisuję..." : "Zapisz"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={pending}
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
            >
              Anuluj
            </button>
          </div>
        </>
      ) : (
        <p className="font-semibold">{body.name}</p>
      )}

      <p className="mt-1 text-xs text-muted-foreground">
        {TYPE_LABEL[body.type] ?? body.type}
        {body.area_ha !== null && ` · ${Math.round(body.area_ha)} ha`}
      </p>

      {error && <p className="mt-2 text-xs text-red-500">⚠ {error}</p>}

      {isAdmin && !editing && (
        <div className="mt-2 flex gap-3 border-t border-border pt-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <Pencil size={12} /> Zmień nazwę
          </button>
          <button
            type="button"
            onClick={() => onRequestDelete(body)}
            className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:underline"
          >
            <Trash2 size={12} /> Usuń
          </button>
        </div>
      )}
    </div>
  );
}
