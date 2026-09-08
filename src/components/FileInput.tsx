"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { compressImage, formatBytes } from "@/lib/compress-image";

type Status =
  | { kind: "empty" }
  | { kind: "working"; name: string }
  | { kind: "ready"; name: string; before: number; after: number };

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
  const [status, setStatus] = useState<Status>({ kind: "empty" });
  const busyRef = useRef(false);
  const resubmitRef = useRef(false);

  // Kompresja jest asynchroniczna, a formularz da się wysłać w jej trakcie -
  // poszedłby wtedy oryginał. Przechwytujemy taki submit przed handlerem
  // Reacta i ponawiamy go, gdy plik jest już gotowy.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) {
      return;
    }

    const onSubmit = (e: Event) => {
      if (!busyRef.current) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      resubmitRef.current = true;
    };

    form.addEventListener("submit", onSubmit, true);
    return () => form.removeEventListener("submit", onSubmit, true);
  }, []);

  const clear = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setStatus({ kind: "empty" });
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setStatus({ kind: "empty" });
      return;
    }

    setStatus({ kind: "working", name: file.name });
    busyRef.current = true;

    try {
      const compressed = await compressImage(file);

      // Podmieniamy zawartość inputa, żeby serwerowe akcje dostały lżejszy plik
      // bez żadnych zmian po swojej stronie.
      if (compressed !== file && inputRef.current) {
        const transfer = new DataTransfer();
        transfer.items.add(compressed);
        inputRef.current.files = transfer.files;
      }

      setStatus({
        kind: "ready",
        name: compressed.name,
        before: file.size,
        after: compressed.size,
      });
    } finally {
      busyRef.current = false;
      if (resubmitRef.current) {
        resubmitRef.current = false;
        inputRef.current?.form?.requestSubmit();
      }
    }
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

      {status.kind === "empty" && (
        <span className="text-sm text-muted-foreground">Brak zdjęcia</span>
      )}

      {status.kind === "working" && (
        <span className="text-sm text-muted-foreground">Kompresuję zdjęcie…</span>
      )}

      {status.kind === "ready" && (
        <span className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <span className="truncate">{status.name}</span>
          <span className="shrink-0 text-xs">
            {status.after < status.before
              ? `(${formatBytes(status.before)} → ${formatBytes(status.after)})`
              : `(${formatBytes(status.after)})`}
          </span>
          <button
            type="button"
            onClick={clear}
            aria-label="Usuń wybrany plik"
            className="shrink-0 rounded-full p-1 hover:bg-muted"
          >
            <X size={14} />
          </button>
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        hidden
        onChange={handleChange}
      />
    </div>
  );
}
