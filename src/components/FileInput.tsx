"use client";

import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";

export default function FileInput({
  name,
  label = "Dodaj zdjęcie",
  accept = "image/*",
}: {
  name: string;
  label?: string;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const clear = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setFileName(null);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted"
      >
        <ImagePlus size={18} />
        {label}
      </button>

      {fileName ? (
        <span className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <span className="truncate">{fileName}</span>
          <button
            type="button"
            onClick={clear}
            aria-label="Usuń wybrany plik"
            className="shrink-0 rounded-full p-1 hover:bg-muted"
          >
            <X size={14} />
          </button>
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">Brak zdjęcia</span>
      )}

      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        hidden
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
    </div>
  );
}
