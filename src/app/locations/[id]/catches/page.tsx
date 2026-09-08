import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CatchBrowser from "@/components/CatchBrowser";
import type { CatchReport } from "@/lib/catches";
import { page, heading, meta, btnSecondary } from "@/lib/ui";

type Location = {
  id: string;
  note: string | null;
};

export default async function LocationCatchesPage({
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

  const [{ data: locationRows, error }, { data: catches }] = await Promise.all([
    supabase.rpc("get_location", { target_id: id }),
    supabase.rpc("list_catches_for_location", { target_location_id: id }),
  ]);

  if (error) {
    throw new Error(error.message);
  }

  const loc = (locationRows as Location[])?.[0];
  if (!loc) {
    notFound();
  }

  const catchList = (catches as CatchReport[]) ?? [];
  const title = loc.note || `Miejscówka ${loc.id.slice(0, 8)}`;

  return (
    <div className={`${page} flex flex-col gap-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={heading}>Historia połowów</h1>
          <p className={meta}>{title}</p>
        </div>
        <a href={`/locations/${loc.id}`} className={btnSecondary}>
          Wróć do miejscówki
        </a>
      </div>

      {/* Filtrowanie i stronicowanie dzieje się po stronie klienta: RPC i tak
          zwraca komplet połowów jednej miejscówki, a to rzędy dziesiątek, nie
          tysięcy. Gdyby lista urosła, trzeba będzie przenieść je do zapytania. */}
      <CatchBrowser catches={catchList} currentUserId={user!.id} />
    </div>
  );
}
