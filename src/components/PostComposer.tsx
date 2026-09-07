"use client";

import { useState } from "react";
import { createPost } from "@/app/feed/actions";
import FileInput from "./FileInput";
import { card, input, btnPrimary } from "@/lib/ui";

type LocationOption = { id: string; label: string };

export default function PostComposer({
  locations,
  groupId,
  placeholder = "Co złowiłeś? Wpisz @ żeby oznaczyć miejscówkę",
}: {
  locations: LocationOption[];
  groupId?: string;
  placeholder?: string;
}) {
  const [content, setContent] = useState("");
  const [locationId, setLocationId] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // aktywna wzmianka = tekst po ostatnim "@", jeśli nie zawiera spacji
  const lastAt = content.lastIndexOf("@");
  const activeMention =
    lastAt >= 0 && !content.slice(lastAt + 1).includes(" ")
      ? content.slice(lastAt + 1).toLowerCase()
      : null;

  const suggestions =
    activeMention === null || dismissed
      ? []
      : locations
          .filter((loc) => loc.label.toLowerCase().includes(activeMention))
          .slice(0, 5);

  const pickLocation = (loc: LocationOption) => {
    setContent(`${content.slice(0, lastAt)}@${loc.label} `);
    setLocationId(loc.id);
    setActiveIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length === 0) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pickLocation(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDismissed(true);
    }
  };

  return (
    <form
      action={async (formData) => {
        await createPost(formData);
        setContent("");
        setLocationId("");
      }}
      className={`${card} mb-6 flex flex-col gap-3`}
    >
      <div className="relative">
        <textarea
          name="content"
          rows={3}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setActiveIndex(0);
            setDismissed(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`${input} resize-none text-base`}
        />

        {suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            {suggestions.map((loc, i) => (
              <li key={loc.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => pickLocation(loc)}
                  className={`flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-sm ${
                    i === activeIndex
                      ? "border-primary bg-muted font-semibold text-primary"
                      : "border-transparent"
                  }`}
                >
                  📍 {loc.label}
                </button>
              </li>
            ))}
            <li className="border-t border-border px-3 py-1 text-xs text-muted-foreground">
              ↑↓ wybór · Enter zatwierdź · Esc zamknij
            </li>
          </ul>
        )}
      </div>

      <input type="hidden" name="location_id" value={locationId} />
      {groupId && <input type="hidden" name="group_id" value={groupId} />}

      <div className="flex items-center justify-between gap-3">
        <FileInput name="photo" />
        <button type="submit" className={btnPrimary}>
          Opublikuj
        </button>
      </div>
    </form>
  );
}
