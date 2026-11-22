"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

type LatLng = { lat: number; lng: number };

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Recenter({ center, zoom }: { center: LatLng; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), zoom));
  }, [center.lat, center.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** OpenStreetMap üzerinde tıklayarak konum seçimi. */
export default function LocationPickerMap({ value, onPick }: { value: LatLng | null; onPick: (p: LatLng) => void }) {
  const center = value ?? { lat: 39.0, lng: 35.2 }; // Türkiye ortası
  return (
    <MapContainer center={center} zoom={value ? 16 : 5} scrollWheelZoom className="h-72 w-full rounded-lg border border-stone-300" style={{ zIndex: 0 }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />
      {value && (
        <>
          <CircleMarker center={value} radius={9} pathOptions={{ color: "#001d48", fillColor: "#fe7001", fillOpacity: 0.95, weight: 3 }} />
          <Recenter center={value} zoom={15} />
        </>
      )}
    </MapContainer>
  );
}
