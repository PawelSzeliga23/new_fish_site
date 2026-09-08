import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateLocation } from "@/app/map/actions";
import FileInput from "@/components/FileInput";
import { page, card, heading, subheading, meta, input, btnPrimary, btnSecondary } from "@/lib/ui";

type Location = {
  id: string;
  user_id: string;
  note: string | null;
  visibility: string;
  access_info: string | null;
  photos: string[] | null;
};

const VISIBILITY_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "private", label: "Prywatna", hint: "Widzisz tylko Ty" },
  { value: "friends", label: "Dla znajomych", hint: "Widzą ją Twoi znajomi" },
  { value: "public", label: "Publiczna", hint: "Widzą ją wszyscy zalogowani" },
];

export default async function EditLocationPage({
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

  const { data: rows, error } = await supabase.rpc("get_location", { target_id: id });

  if (error) {
    throw new Error(error.message);
  }

  const loc = (rows as Location[])?.[0];
  if (!loc) {
    notFound();
  }

  // Edytować może tylko właściciel - RLS i tak by zablokowało zapis, ale nie ma
  // powodu pokazywać formularza, który na pewno się nie uda.
  if (loc.user_id !== user!.id) {
    redirect(`/locations/${id}`);
  }

  return (
    <div className={`${page} flex flex-col gap-5`}>
      <h1 className={heading}>Edytuj miejscówkę</h1>

      <form action={updateLocation} className={`${card} flex flex-col gap-4`}>
        <input type="hidden" name="location_id" value={loc.id} />

        <div className="flex flex-col gap-1">
          <label htmlFor="note" className={subheading}>
            Nazwa
          </label>
          <input
            id="note"
            name="note"
            required
            maxLength={80}
            defaultValue={loc.note ?? ""}
            placeholder="np. Zatoka przy pomoście"
            className={input}
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className={subheading}>Widoczność</legend>
          {VISIBILITY_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="visibility"
                value={option.value}
                defaultChecked={loc.visibility === option.value}
                className="mt-1"
              />
              <span>
                <span className="font-semibold">{option.label}</span>
                <span className={`${meta} block`}>{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="access_info" className={subheading}>
            Jak dotrzeć
          </label>
          <textarea
            id="access_info"
            name="access_info"
            rows={4}
            defaultValue={loc.access_info ?? ""}
            placeholder="np. Zjazd polną drogą od strony wsi X, parking przy moście..."
            className={input}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className={subheading}>Zdjęcie</span>
          {loc.photos?.[0] && (
            <img
              src={loc.photos[0]}
              alt="Obecne zdjęcie miejscówki"
              className="h-32 w-32 rounded-2xl object-cover"
            />
          )}
          <FileInput name="photo" label="Zmień zdjęcie" />
        </div>

        <div className="flex gap-2">
          <button type="submit" className={btnPrimary}>
            Zapisz
          </button>
          <a href={`/locations/${loc.id}`} className={btnSecondary}>
            Anuluj
          </a>
        </div>
      </form>
    </div>
  );
}
