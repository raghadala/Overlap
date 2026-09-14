import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import type { Pin, OverlappingPin } from '../api/client';

// rough Canada bounds
const CANADA_BOUNDS: [[number, number], [number, number]] = [
  [41.7, -141],
  [83.1, -52.6],
];
const CANADA_CENTER: [number, number] = [56.1304, -106.3468];

const pinIcon = new L.Icon.Default();

function ClickToDrop({ onDrop }: { onDrop: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onDrop(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapPage() {
  const { token, logout } = useAuth();
  const [pins, setPins] = useState<Pin[]>([]);
  const [draftLocation, setDraftLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('missed_connection');
  const [overlapsByPin, setOverlapsByPin] = useState<Record<number, OverlappingPin[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.myPins(token).then(setPins).catch((err) => setError(err.message));
  }, [token]);

  async function handleDrop(lat: number, lng: number) {
    setDraftLocation({ lat, lng });
  }

  async function handleCreatePin() {
    if (!token || !draftLocation || !note.trim()) return;
    try {
      const pin = await api.createPin(token, {
        latitude: draftLocation.lat,
        longitude: draftLocation.lng,
        note,
        category,
      });
      setPins((prev) => [...prev, { ...pin, latitude: draftLocation.lat, longitude: draftLocation.lng } as Pin]);
      setDraftLocation(null);
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pin');
    }
  }

  async function loadOverlaps(pinId: number) {
    if (!token) return;
    try {
      const overlaps = await api.overlappingPins(token, pinId);
      setOverlapsByPin((prev) => ({ ...prev, [pinId]: overlaps }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overlaps');
    }
  }

  async function sendRequest(fromPinId: number, toPinId: number) {
    if (!token) return;
    try {
      await api.sendConnectionRequest(token, fromPinId, toPinId);
      alert('Connection request sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    }
  }

  return (
    <div className="map-page">
      <header>
        <h2>Overlap</h2>
        <button onClick={logout}>Log out</button>
      </header>

      {error && <p className="error">{error}</p>}

      <MapContainer
        center={CANADA_CENTER}
        zoom={4}
        maxBounds={CANADA_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: '70vh', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToDrop onDrop={handleDrop} />

        {pins.map((pin) => (
          <Marker key={pin.id} position={[pin.latitude, pin.longitude]} icon={pinIcon}>
            <Popup>
              <div>
                <strong>{pin.category.replace('_', ' ')}</strong>
                <p>{pin.note}</p>
                <button onClick={() => loadOverlaps(pin.id)}>Check for overlaps</button>
                {overlapsByPin[pin.id] && (
                  <ul>
                    {overlapsByPin[pin.id].length === 0 && <li>No overlapping pins yet.</li>}
                    {overlapsByPin[pin.id].map((o) => (
                      <li key={o.id}>
                        {o.note}
                        <button onClick={() => sendRequest(pin.id, o.id)}>Request to connect</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {draftLocation && (
          <Marker position={[draftLocation.lat, draftLocation.lng]} icon={pinIcon}>
            <Popup>
              <div className="pin-form">
                <textarea
                  placeholder="What happened here?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="missed_connection">Missed connection</option>
                  <option value="lost_item">Lost item</option>
                  <option value="photo_moment">Photo moment</option>
                </select>
                <button onClick={handleCreatePin}>Drop pin</button>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      <p className="hint">Click anywhere on the map to drop a pin.</p>
    </div>
  );
}
