const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data as T;
}

export interface AuthResponse {
  token: string;
  user: { id: number; email: string };
}

export interface Pin {
  id: number;
  latitude: number;
  longitude: number;
  radius_m: number;
  note: string;
  category: 'missed_connection' | 'lost_item' | 'photo_moment';
  created_at: string;
  expires_at: string;
  nearby_count: string;
  sent_count: string;
  received_count: string;
}

export interface OverlappingPin {
  id: number;
  note: string;
  category: string;
  created_at: string;
  user_id: number;
}

export interface ConnectionRequest {
  id: number;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface IncomingRequest {
  id: number;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  from_note: string;
  from_category: string;
  to_pin_id: number;
}

export interface OutgoingRequest {
  id: number;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  to_note: string;
  to_category: string;
  from_pin_id: number;
}

export const api = {
  signup: (email: string, password: string) =>
    request<AuthResponse>('/auth/signup', { method: 'POST', body: { email, password } }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),

  loginWithGoogle: (idToken: string) =>
    request<AuthResponse>('/auth/google', { method: 'POST', body: { idToken } }),

  createPin: (token: string, pin: { latitude: number; longitude: number; note: string; category: string; radiusMeters?: number }) =>
    request<Pin>('/pins', { method: 'POST', body: pin, token }),

  myPins: (token: string) => request<Pin[]>('/pins/mine', { token }),

  deletePin: (token: string, pinId: number) =>
    request<void>(`/pins/${pinId}`, { method: 'DELETE', token }),

  overlappingPins: (token: string, pinId: number) =>
    request<OverlappingPin[]>(`/pins/${pinId}/overlapping`, { token }),

  sendConnectionRequest: (token: string, fromPinId: number, toPinId: number) =>
    request<ConnectionRequest>('/connections', { method: 'POST', body: { fromPinId, toPinId }, token }),

  respondToRequest: (token: string, requestId: number, accept: boolean) =>
    request<ConnectionRequest>(`/connections/${requestId}/respond`, { method: 'POST', body: { accept }, token }),

  getConnection: (token: string, requestId: number) =>
    request<{ status: string; contacts?: { userId: number; email: string }[] }>(`/connections/${requestId}`, { token }),

  incomingRequests: (token: string) => request<IncomingRequest[]>('/connections/incoming', { token }),

  outgoingRequests: (token: string) => request<OutgoingRequest[]>('/connections/outgoing', { token }),
};