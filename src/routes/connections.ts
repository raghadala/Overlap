import { Router } from 'express';
import pool from '../db/pool';
import requireAuth from '../middleware/requireAuth';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  const { fromPinId, toPinId } = req.body as { fromPinId?: number; toPinId?: number };

  const fromPin = await pool.query('SELECT id FROM pins WHERE id = $1 AND user_id = $2', [fromPinId, req.userId]);
  if (fromPin.rows.length === 0) {
    return res.status(403).json({ error: 'You can only send requests from your own pin' });
  }

  const result = await pool.query(
    `INSERT INTO connection_requests (from_pin_id, to_pin_id)
     VALUES ($1, $2)
     ON CONFLICT (from_pin_id, to_pin_id) DO NOTHING
     RETURNING id, status, created_at`,
    [fromPinId, toPinId]
  );

  if (result.rows.length === 0) {
    return res.status(409).json({ error: 'A request for this pin pair already exists' });
  }

  res.status(201).json(result.rows[0]);
});

router.post('/:id/respond', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { accept } = req.body as { accept?: boolean };

  const request = await pool.query(
    `SELECT cr.id, cr.from_pin_id, cr.to_pin_id, p.user_id AS recipient_user_id
     FROM connection_requests cr
     JOIN pins p ON p.id = cr.to_pin_id
     WHERE cr.id = $1`,
    [id]
  );

  if (request.rows.length === 0) {
    return res.status(404).json({ error: 'Request not found' });
  }

  if (request.rows[0].recipient_user_id !== req.userId) {
    return res.status(403).json({ error: 'This request was not sent to you' });
  }

  const newStatus = accept ? 'accepted' : 'declined';

  await pool.query('UPDATE connection_requests SET status = $1 WHERE id = $2', [newStatus, id]);

  res.json({ id, status: newStatus });
});

// only returns contact info once both sides have accepted.
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT cr.status, uf.id AS from_user_id, uf.email AS from_email,
            ut.id AS to_user_id, ut.email AS to_email
     FROM connection_requests cr
     JOIN pins pf ON pf.id = cr.from_pin_id
     JOIN pins pt ON pt.id = cr.to_pin_id
     JOIN users uf ON uf.id = pf.user_id
     JOIN users ut ON ut.id = pt.user_id
     WHERE cr.id = $1 AND (pf.user_id = $2 OR pt.user_id = $2)`,
    [id, req.userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const row = result.rows[0];

  if (row.status !== 'accepted') {
    return res.json({ status: row.status });
  }

  res.json({
    status: row.status,
    contacts: [
      { userId: row.from_user_id, email: row.from_email },
      { userId: row.to_user_id, email: row.to_email },
    ],
  });
});

export default router;
