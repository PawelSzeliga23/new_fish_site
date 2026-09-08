/**
 * Nazywanie bezimiennych obrysów na podstawie sąsiedztwa.
 *
 * Wywołuje name_unnamed_water_bodies partiami, aż zabraknie kandydatów. Partiami,
 * bo każdy kandydat wymaga dwóch zapytań przestrzennych i sześćdziesiąt kilka
 * tysięcy naraz nie zmieściłoby się w limicie czasu instrukcji.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const line of raw.split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let total = 0;
const started = Date.now();

for (let i = 0; i < 600; i++) {
  const { data, error } = await supabase.rpc("name_unnamed_water_bodies", {
    batch_size: 150,
  });

  if (error) {
    console.error(`blad w partii ${i + 1}:`, error.message);
    break;
  }
  if (!data) {
    break;
  }

  total += data;
  if ((i + 1) % 25 === 0) {
    console.log(`  przetworzono ${total} obrysow (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  }
}

console.log(`Sprawdzono ${total} bezimiennych obrysow.`);
