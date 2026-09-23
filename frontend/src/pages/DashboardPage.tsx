import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import type { Pin, IncomingRequest, OutgoingRequest, OverlappingPin } from '../api/client';

type Tab = 'active' | 'received' | 'sent';

const CATEGORY_LABELS: Record<string, string> = {
  missed_connection: 'Missed connection',
  lost_item: 'Lost item',
  photo_moment: 'Photo moment',
};

function daysLeft(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('active');

  const [pins, setPins] = useState<Pin[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
  const [expandedPin, setExpandedPin] = useState<number | null>(null);
  const [nearbyByPin, setNearbyByPin] = useState<Record<number, OverlappingPin[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function refreshAll() {
    if (!token) return;
    api.myPins(token).then(setPins).catch((err) => setError(err.message));
    api.incomingRequests(token).then(setIncoming).catch((err) => setError(err.message));
    api.outgoingRequests(token).then(setOutgoing).catch((err) => setError(err.message));
  }

  async function toggleExpand(pin: Pin) {
    if (expandedPin === pin.id) {
      setExpandedPin(null);
      return;
    }
    setExpandedPin(pin.id);
    if (!token || nearbyByPin[pin.id]) return;
    try {
      const overlaps = await api.overlappingPins(token, pin.id);
      setNearbyByPin((prev) => ({ ...prev, [pin.id]: overlaps }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nearby pins');
    }
  }

  async function handleDeletePin(pinId: number) {
    if (!token) return;
    if (!confirm('Delete this pin? This cannot be undone.')) return;
    try {
      await api.deletePin(token, pinId);
      setPins((prev) => prev.filter((p) => p.id !== pinId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pin');
    }
  }

  async function handleConnect(fromPinId: number, toPinId: number) {
    if (!token) return;
    try {
      await api.sendConnectionRequest(token, fromPinId, toPinId);
      refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    }
  }

  async function handleRespond(requestId: number, accept: boolean) {
    if (!token) return;
    try {
      await api.respondToRequest(token, requestId, accept);
      refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond');
    }
  }

  return (
    <div className="dashboard-page">
      <header>
        <h2>Overlap</h2>
        <Link to="/">Back to map</Link>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="dashboard-tabs">
        <button className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>
          Active Pins <span className="tab-count">{pins.length}</span>
        </button>
        <button className={tab === 'received' ? 'active' : ''} onClick={() => setTab('received')}>
          Received <span className="tab-count">{incoming.length}</span>
        </button>
        <button className={tab === 'sent' ? 'active' : ''} onClick={() => setTab('sent')}>
          Sent <span className="tab-count">{outgoing.length}</span>
        </button>
      </div>

      {tab === 'active' && (
        <div className="dashboard-list">
          {pins.length === 0 && <p className="hint">No active pins yet. Drop one on the map.</p>}
          {pins.map((pin) => (
            <div key={pin.id} className="pin-card">
              <div className="pin-card-header" onClick={() => toggleExpand(pin)}>
                <div>
                  <strong>{CATEGORY_LABELS[pin.category] || pin.category}</strong>
                  <p className="pin-card-note">{pin.note}</p>
                </div>
                <span className="expand-arrow">{expandedPin === pin.id ? '\u2303' : '\u2304'}</span>
              </div>

              <div className="pin-card-stats">
                <span>{pin.nearby_count} nearby</span>
                <span>{pin.sent_count} sent</span>
                <span>{pin.received_count} received</span>
              </div>
              <div className="pin-card-meta">
                {daysLeft(pin.expires_at)} days left &middot; Radius: {pin.radius_m}m
              </div>

              {expandedPin === pin.id && (
                <div className="pin-card-expanded">
                  <h4>Nearby profiles</h4>
                  {!nearbyByPin[pin.id] && <p>Loading...</p>}
                  {nearbyByPin[pin.id]?.length === 0 && <p>No overlapping pins yet.</p>}
                  {nearbyByPin[pin.id]?.map((o) => (
                    <div key={o.id} className="nearby-profile">
                      <p>{o.note}</p>
                      <button onClick={() => handleConnect(pin.id, o.id)}>Connect</button>
                    </div>
                  ))}
                  <button className="delete-pin-button" onClick={() => handleDeletePin(pin.id)}>
                    Delete pin
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'received' && (
        <div className="dashboard-list">
          {incoming.length === 0 && <p className="hint">No incoming requests.</p>}
          {incoming.map((r) => (
            <div key={r.id} className="request-card">
              <div>
                <strong>{CATEGORY_LABELS[r.from_category] || r.from_category}</strong>
                <p>{r.from_note}</p>
              </div>
              <div className="request-actions">
                <button onClick={() => handleRespond(r.id, true)}>Accept</button>
                <button className="decline-button" onClick={() => handleRespond(r.id, false)}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'sent' && (
        <div className="dashboard-list">
          {outgoing.length === 0 && <p className="hint">You haven't sent any requests yet.</p>}
          {outgoing.map((r) => (
            <div key={r.id} className="request-card">
              <div>
                <strong>{CATEGORY_LABELS[r.to_category] || r.to_category}</strong>
                <p>{r.to_note}</p>
              </div>
              <span className={`status-badge status-${r.status}`}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}