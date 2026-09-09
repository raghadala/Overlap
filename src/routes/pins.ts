import { Router } from 'express';
import pool from '../db/pool';
import requireAuth from '../middleware/requireAuth';

const router = Router();

const VALID_CATEGORIES = ['missed_connection', 'lost_item', 'photo_moment'] as const;
type Category = (typeof VALID_CATEGORIES)[number];

const DEFAULT_ACTIVE_DAYS = 14;

interface CreatePinBody {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  note?: string;
  category?: Category;
  activeDays?: number;
}

router.post('/', requireAuth, async (req, res) => {
  const { latitude, longitude, radiusMeters, note, category, activeDays } = req.body as CreatePinBody;

  if (latitude == null || longitude == null || !note || !category) {
    return res.status(400).json({ error: 'latitude, longitude, note, and category are required' });
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }

  const radius = radiusMeters || 200;
  const days = activeDays || DEFAULT_ACTIVE_DAYS;

  const result = await pool.query(
    `INSERT INTO pins (user_id, location, radius_m, note, category, expires_at)
     VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4, $5, $6, now() + ($7 || ' days')::interval)
     RETURNING id, radius_m, note, category, created_at, expires_at`,
    [req.userId, longitude, latitude, radius, note, category, days]
  );

  res.status(201).json(result.rows[0]);
});

router.get('/mine', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT id, ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude,
            radius_m, note, category, created_at, expires_at
     FROM pins
     WHERE user_id = $1 AND expires_at > now()
     ORDER BY created_at DESC`,
    [req.userId]
  );

  res.json(result.rows);
});

router.get('/:id/overlapping', requireAuth, async (req, res) => {
  const { id } = req.params;

  const ownPin = await pool.query(
    'SELECT id, location, radius_m FROM pins WHERE id = $1 AND user_id = $2',
    [id, req.userId]
  );

  if (ownPin.rows.length === 0) {
    return res.status(404).json({ error: 'Pin not found' });
  }

  const { location, radius_m } = ownPin.rows[0];

  const result = await pool.query(
    `SELECT p.id, p.note, p.category, p.created_at, u.id AS user_id
     FROM pins p
     JOIN users u ON u.id = p.user_id
     WHERE p.user_id != $1
       AND p.expires_at > now()
       AND ST_DWithin(p.location, $2, p.radius_m + $3)
     ORDER BY p.created_at DESC`,
    [req.userId, location, radius_m]
  );

  res.json(result.rows);
});

export default router;
