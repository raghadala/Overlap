import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import type { Pin, OverlappingPin } from '../api/client';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// rough Canada bounds
const CANADA_BOUNDS: [[number, number], [number, number]] = [
  [41.7, -141],
  [83.1, -52.6],
];
const CANADA_CENTER: [number, number] = [56.1304, -106.3468];

const pinIcon = new L.Icon.Default();

interface PhotonFeature {
  geometry: {
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
}

function shortAddress(feature: PhotonFeature): string {
  const p = feature.properties;
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const parts = [p.name, street, p.city, p.postcode, p.country].filter(Boolean);
  return parts.join(', ') || 'Unknown location';
}

function ClickToDrop({ onDrop }: { onDrop: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onDrop(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 15);
  }, [target, map]);
  return null;
}

function AddressSearch({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          limit: '5',
          bbox: '-141,41.7,-52.6,83.1',
        });
        const res = await fetch(`https://photon.komoot.io/api/?${params}`);
        const data = await res.json();
        const features: PhotonFeature[] = data.features || [];

        const seen = new Set<string>();
        const deduped = features.filter((f) => {
          const label = shortAddress(f);
          if (seen.has(label)) return false;
          seen.add(label);
          return true;
        });

        setResults(deduped);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleSelect(feature: PhotonFeature) {
    const [lon, lat] = feature.geometry.coordinates;
    onSelect(lat, lon);
    setQuery(shortAddress(feature));
    setResults([]);
  }

  return (
    <div className="address-search">
      <input
        type="text"
        placeholder="Search for an address or place in Canada"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading && <div className="address-search-loading">Searching...</div>}
      {results.length > 0 && (
        <ul className="address-search-results">
          {results.map((r, i) => (
            <li key={i} onClick={() => handleSelect(r)}>
              {shortAddress(r)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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

      <div className="map-container-wrapper">
      <AddressSearch onSelect={(lat, lng) => setDraftLocation({ lat, lng })} />
      <MapContainer
        center={CANADA_CENTER}
        zoom={4}
        maxBounds={CANADA_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: '70vh', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; OpenStreetMap contributors'
          url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`}
        />
        <ClickToDrop onDrop={handleDrop} />
        <FlyTo target={draftLocation} />

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
      </div>

      <p className="hint">Click anywhere on the map, or search an address above, to drop a pin.</p>
    </div>
  );
}