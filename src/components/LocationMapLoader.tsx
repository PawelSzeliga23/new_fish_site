"use client";

import dynamic from "next/dynamic";
import type { LocationMapProps } from "./LocationMap";

// Leaflet sięga po window już przy imporcie, więc mapka nie może renderować się
// po stronie serwera.
const LocationMap = dynamic(() => import("./LocationMap"), { ssr: false });

export default function LocationMapLoader(props: LocationMapProps) {
  return <LocationMap {...props} />;
}
