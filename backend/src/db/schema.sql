CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT has_login_method CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);

CREATE TABLE pins (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  radius_m INTEGER NOT NULL DEFAULT 200,
  note TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('missed_connection', 'lost_item', 'photo_moment')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX pins_location_idx ON pins USING GIST (location);

CREATE TABLE connection_requests (
  id SERIAL PRIMARY KEY,
  from_pin_id INTEGER NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  to_pin_id INTEGER NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_pin_id, to_pin_id)
);
