"use client";

import dynamic from "next/dynamic";
import type { LocationPoint } from "./MapView";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

export default function MapLoader({
  locations,
  isAdmin,
}: {
  locations: LocationPoint[];
  isAdmin: boolean;
}) {
  return <MapView locations={locations} isAdmin={isAdmin} />;
}
