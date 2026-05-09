'use client';

import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

type Pin = { lat: number; lng: number };

type Props = {
  center: [number, number];
  zoom: number;
  pins: Pin[];
};

export function DistrictLeadMap({ center, zoom, pins }: Props) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pins.map((pin, i) => (
        <CircleMarker
          key={i}
          center={[pin.lat, pin.lng]}
          radius={6}
          pathOptions={{ color: '#0f766e', fillColor: '#0f766e', fillOpacity: 0.7 }}
        />
      ))}
    </MapContainer>
  );
}
