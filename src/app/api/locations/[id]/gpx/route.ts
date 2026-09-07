import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Musisz być zalogowany" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("get_location", {
    target_id: id,
  });

  if (error || !data?.[0]) {
    return NextResponse.json({ error: "Nie znaleziono miejscówki" }, { status: 404 });
  }

  const loc = data[0];
  const name = escapeXml(loc.note || "Miejscówka");

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wedkarski Portal" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="${loc.lat}" lon="${loc.lng}">
    <name>${name}</name>
  </wpt>
</gpx>`;

  return new NextResponse(gpx, {
    headers: {
      "Content-Type": "application/gpx+xml",
      "Content-Disposition": `attachment; filename="miejscowka-${id.slice(0, 8)}.gpx"`,
    },
  });
}
