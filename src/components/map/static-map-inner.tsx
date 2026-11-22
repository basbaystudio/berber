"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";

export default function StaticMapInner({ lat, lng }: { lat: number; lng: number }) {
  return (
    <MapContainer center={{ lat, lng }} zoom={16} scrollWheelZoom={false} dragging className="h-64 w-full rounded-2xl" style={{ zIndex: 0 }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <CircleMarker center={{ lat, lng }} radius={9} pathOptions={{ color: "#001d48", fillColor: "#fe7001", fillOpacity: 0.95, weight: 3 }} />
    </MapContainer>
  );
}
